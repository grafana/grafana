import { debounce } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useMeasure } from 'react-use';

import { type DataFrame, type DataSourceRef, dateTime, outerJoinDataFrames, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  dataLayers,
  type SceneComponentProps,
  SceneDataLayerSet,
  type SceneDataProvider,
  type SceneDataQuery,
  SceneDataTransformer,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { type AnnotationQuery } from '@grafana/schema';
import { IconButton, MultiSelect, Toggletip } from '@grafana/ui';

import { DashboardAnnotationsDataLayer } from '../DashboardAnnotationsDataLayer';

import { TimeNavigator } from './TimeNavigator';
import { approxEqual, computeContextWindow, CONTEXT_ZOOM_FACTOR, type TimeRangeMs } from './timeModel';

const EMPTY_TIME: number[] = [];
const EMPTY_SERIES: number[][] = [];
/** Downsample target for the background sparkline query (resolution for the bar). */
const SPARKLINE_MAX_DATA_POINTS = 100;
/** The built-in "Mixed" datasource lets one runner combine queries across different datasources. */
const MIXED_DATASOURCE: DataSourceRef = { uid: '-- Mixed --' };

export interface SceneTimeNavigatorState extends SceneObjectState {
  height?: number;
  contextZoomFactor?: number;
  /** Keys of the dashboard panels whose queries feed the background sparklines (live references). */
  sourcePanelKeys?: string[];
  /** Names of the dashboard annotation queries to re-run and mark on the bar (chosen via the picker). */
  annotationNames?: string[];
  /** Annotation frames (re-run over the context window) rendered as markers on the bar. */
  annotations?: DataFrame[];
  /** The annotation layers scoped to the context window. Kept in state (created once in the constructor) so
   * its $timeRange is parented into the scene graph and its layers can be swapped in place; its results
   * stream drives `annotations`. */
  annotationSet?: SceneDataLayerSet;
  /** Our own query runner for the sparklines, scoped to the context window (see _contextRange). */
  $data?: SceneDataProvider;
}

/**
 * A dashboard control that renders the time navigator (a zoomed-out context window with a brushed selection that
 * drives the dashboard time range) with optional background sparklines. The sparklines reuse other panels'
 * queries (by key) but re-run them against the *context window* — its own SceneTimeRange, wider than the
 * dashboard/selection range — with its own downsampling, so they render across the whole bar.
 */
export class SceneTimeNavigator extends SceneObjectBase<SceneTimeNavigatorState> {
  public static Component = SceneTimeNavigatorRenderer;

  /** The range the sparkline query runs against — the context window, independent of the dashboard time.
   *  Lives in the graph as $data's $timeRange; this member is just a handle to that in-state object. */
  private _contextRange: SceneTimeRange;
  /** The same context window for the annotation layers. A SEPARATE instance from _contextRange: one
   *  SceneTimeRange can't be the $timeRange of two parents without re-parenting warnings. Lives in the
   *  graph as annotationSet's $timeRange; this member is just a handle to it. */
  private _annoRange: SceneTimeRange;

  public constructor(state: Partial<SceneTimeNavigatorState> = {}) {
    const contextRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
    const annoRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
    // Keep the annotation layer set in state from the start, with annoRange as its $timeRange, so annoRange
    // is parented into the graph once. _applyAnnotations then swaps this set's `layers` in place instead of
    // recreating the set (which would re-parent annoRange every time -> "already has a parent" warnings).
    // SceneDataLayerSet's constructor drops a $timeRange, so set it afterwards.
    const annotationSet = new SceneDataLayerSet({ layers: [] });
    annotationSet.setState({ $timeRange: annoRange });
    super({
      ...state,
      $data: new SceneQueryRunner({ queries: [], maxDataPoints: SPARKLINE_MAX_DATA_POINTS, $timeRange: contextRange }),
      annotationSet,
    });
    this._contextRange = contextRange;
    this._annoRange = annoRange;
    this.addActivationHandler(() => this._activationHandler());
  }

  /** Per-dashboard localStorage key for a saved selection. */
  private _storageKey(kind: 'sources' | 'annotations'): string | undefined {
    // Duck-type the dashboard uid off the root state so we don't import DashboardScene (which would
    // reintroduce the circular dependency).
    const rootState: { uid?: string } = this.getRoot().state;
    const uid = rootState.uid;
    return uid ? `grafana.dashboard.timeNavigator.${kind}.${uid}` : undefined;
  }

  private _activationHandler() {
    // Restore this dashboard's saved selections. Default to nothing so we run no extra queries.
    if (!this.state.sourcePanelKeys?.length) {
      const key = this._storageKey('sources');
      const saved = key ? store.getObject<string[]>(key) : undefined;
      if (saved?.length) {
        this.setState({ sourcePanelKeys: saved });
      }
    }
    if (!this.state.annotationNames?.length) {
      const key = this._storageKey('annotations');
      const saved = key ? store.getObject<string[]>(key) : undefined;
      if (saved?.length) {
        this.setState({ annotationNames: saved });
      }
    }
    // Seed the context window from the dashboard's current range before the first sparkline/annotation
    // query runs. Otherwise they query the placeholder now-6h/now window set in the constructor (the
    // dashboard range isn't known there), then re-query the real ~factor×-wider window once TimeNavigator's
    // debounced context update lands ~350ms later — a wrong first query plus a wasted second one. Because
    // $data/_contextRange aren't subscribed until after this handler returns, seeding here doesn't itself
    // schedule an extra query.
    const dashRange = sceneGraph.getTimeRange(this).state.value;
    const factor = this.state.contextZoomFactor ?? CONTEXT_ZOOM_FACTOR;
    this.setContextRange(
      computeContextWindow({ from: dashRange.from.valueOf(), to: dashRange.to.valueOf() }, Date.now(), factor)
    );
    this._applySources();

    // Activate the (stable) annotation set once and stream its results into `annotations`; which layers it
    // holds is (re)populated by _applyAnnotations (an empty set emits empty data -> annotations = []).
    const set = this.state.annotationSet!;
    const deactivate = set.activate();
    const sub = set.getResultsStream().subscribe((res) => {
      this.setState({ annotations: res.data.series ?? [] });
    });
    this._applyAnnotations();
    return () => {
      sub.unsubscribe();
      deactivate();
    };
  }

  /**
   * Re-run the selected dashboard annotation queries over the context window by swapping FRESH layers onto
   * the stable `annotationSet` (kept in state, scoped to our context SceneTimeRange). The set's results are
   * streamed to `annotations` by the activation handler. Building our own layers (rather than reusing the
   * live dashboard ones) avoids repointing the range the dashboard panels resolve; their queries still
   * enrich the request with the dashboard by walking up the graph.
   */
  private _applyAnnotations() {
    const set = this.state.annotationSet;
    if (!set) {
      return;
    }
    const names = new Set(this.state.annotationNames ?? []);
    let queries: AnnotationQuery[] = [];
    if (names.size) {
      try {
        queries = getDashboardAnnotationLayers(this)
          // Match on the layer's state.name — that's what the picker stores as its value; a layer's
          // query.name can differ (or be empty), so filtering on query.name would silently drop selections.
          .filter((l) => names.has(l.state.name ?? ''))
          .map((l) => l.state.query);
      } catch {
        queries = [];
      }
    }
    // Swap the stable set's layers (fresh instances, each parented exactly once — no re-parent churn). An
    // empty `layers` makes the set emit empty data, driving `annotations` to [] via the results stream.
    const layers = queries.map(
      (query) => new DashboardAnnotationsDataLayer({ query, name: query.name, isEnabled: true })
    );
    set.setState({ layers });
  }

  /** Choose which dashboard annotation queries to show on the bar. */
  public setAnnotations(names: string[]) {
    this.setState({ annotationNames: names });
    const key = this._storageKey('annotations');
    if (key) {
      store.setObject(key, names);
    }
    this._applyAnnotations();
  }

  private _applySources() {
    const runner = this.state.$data;
    if (!(runner instanceof SceneQueryRunner)) {
      return;
    }
    const root = this.getRoot();
    const queries: SceneDataQuery[] = [];
    for (const key of this.state.sourcePanelKeys ?? []) {
      let panel: VizPanel | undefined;
      try {
        panel = sceneGraph.findByKeyAndType(root, key, VizPanel);
      } catch {
        // No matching VizPanel for this key (removed/renamed) — skip it.
        panel = undefined;
      }
      const source = getQueryRunnerForPanel(panel);
      if (!source) {
        continue;
      }
      // No panel-level datasource means all queries share one; fall back to the first query's datasource.
      const ds = source.state.datasource ?? source.state.queries?.[0]?.datasource;
      for (const q of source.state.queries) {
        // Unique refIds across panels; carry each query's datasource so the Mixed runner routes it.
        queries.push({ ...q, refId: `S${queries.length}`, datasource: q.datasource ?? ds ?? undefined });
      }
    }
    runner.setState({ queries, datasource: MIXED_DATASOURCE });
    runner.runQueries();
  }

  /** Choose which panels' queries feed the sparklines. */
  public setSourcePanels(keys: string[]) {
    this.setState({ sourcePanelKeys: keys });
    const key = this._storageKey('sources');
    if (key) {
      store.setObject(key, keys);
    }
    this._applySources();
  }

  /** Update the range the sparklines and annotations are queried over (the context window). Caller debounces. */
  public setContextRange({ from, to }: TimeRangeMs) {
    // Ignore no-op updates so the debounced first emit that just echoes the activation seed (and
    // autorefresh echoes) doesn't trigger a redundant re-query. approxEqual's 1s tolerance is far below
    // the hour-scale context window, so it never swallows a real pan/zoom.
    const cur = this._contextRange.state.value;
    if (approxEqual({ from, to }, { from: cur.from.valueOf(), to: cur.to.valueOf() })) {
      return;
    }
    const f = dateTime(from);
    const to2 = dateTime(to);
    const range = { from: f, to: to2, raw: { from: f, to: to2 } };
    this._contextRange.onTimeRangeChange(range);
    this._annoRange.onTimeRangeChange(range);
  }
}

/**
 * Unwrap a scene object's data provider to its SceneQueryRunner. Handles a SceneDataTransformer wrapping
 * the runner, and falls back to the parent's $data (panels store their runner on the panel or its parent).
 */
function getQueryRunnerForPanel(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }
  const dataProvider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;
  if (dataProvider instanceof SceneQueryRunner) {
    return dataProvider;
  }
  if (dataProvider instanceof SceneDataTransformer) {
    return getQueryRunnerForPanel(dataProvider);
  }
  return undefined;
}

/**
 * The dashboard's annotation layers, reachable from the given scene object. `sceneGraph.getDataLayers`
 * walks UP the graph to the dashboard's data-layer set(s); we then walk DOWN each set to collect the
 * individual AnnotationsDataLayer instances (public API, no dashboard-scene imports).
 */
function getDashboardAnnotationLayers(sceneObject: SceneObject): dataLayers.AnnotationsDataLayer[] {
  return sceneGraph
    .getDataLayers(sceneObject)
    .flatMap((set) => sceneGraph.findAllObjects(set, (o) => o instanceof dataLayers.AnnotationsDataLayer))
    .filter((o): o is dataLayers.AnnotationsDataLayer => o instanceof dataLayers.AnnotationsDataLayer);
}

function extractSparklines(series: DataFrame[] | undefined): { time: number[]; values: number[][] } {
  if (!series?.length) {
    return { time: EMPTY_TIME, values: EMPTY_SERIES };
  }
  // Align all frames onto one time axis so uPlot can draw them as parallel series (gaps become nulls).
  const joined = outerJoinDataFrames({ frames: series });
  const timeField = joined?.fields.find((f) => f.type === 'time');
  const valueFields = joined?.fields.filter((f) => f.type === 'number') ?? [];
  if (!timeField || !valueFields.length) {
    return { time: EMPTY_TIME, values: EMPTY_SERIES };
  }
  return { time: timeField.values, values: valueFields.map((f) => f.values) };
}

function SceneTimeNavigatorRenderer({ model }: SceneComponentProps<SceneTimeNavigator>) {
  const {
    height = 88,
    contextZoomFactor = CONTEXT_ZOOM_FACTOR,
    sourcePanelKeys,
    annotationNames,
    annotations,
  } = model.useState();
  const { value } = sceneGraph.getTimeRange(model).useState();
  const { data } = sceneGraph.getData(model).useState();
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const spark = useMemo(() => extractSparklines(data?.series), [data]);
  const onContextWindowChange = useMemo(() => debounce((r: TimeRangeMs) => model.setContextRange(r), 350), [model]);
  // Cancel any pending debounced update on unmount so it can't call setContextRange after the navigator is
  // hidden or the dashboard navigates away.
  useEffect(() => () => onContextWindowChange.cancel(), [onContextWindowChange]);

  const root = model.getRoot();
  const panelOptions = sceneGraph
    .findAllObjects(root, (o) => o instanceof VizPanel)
    .filter((o): o is VizPanel => o instanceof VizPanel)
    .map((p) => ({
      label: p.state.title || p.state.key || '',
      value: p.state.key || '',
    }));
  let annotationOptions: Array<{ label: string; value: string }> = [];
  try {
    annotationOptions = getDashboardAnnotationLayers(model).map((l) => ({
      label: l.state.name ?? '',
      value: l.state.name ?? '',
    }));
  } catch {
    // No annotation layers on this scene — leave the picker empty.
  }

  return (
    <div ref={ref} style={{ width: '100%', minHeight: height }}>
      {width > 0 && (
        <TimeNavigator
          value={{ from: value.from.valueOf(), to: value.to.valueOf() }}
          now={Date.now()}
          width={width}
          height={height}
          time={spark.time}
          values={spark.values}
          annotations={annotations}
          contextZoomFactor={contextZoomFactor}
          onChangeTimeRange={(range) => {
            const from = dateTime(range.from);
            const to = dateTime(range.to);
            sceneGraph.getTimeRange(model).onTimeRangeChange({ from, to, raw: { from, to } });
          }}
          onContextWindowChange={onContextWindowChange}
          extraControls={
            <>
              <Toggletip
                placement="bottom-start"
                content={
                  <div style={{ width: 320 }}>
                    <MultiSelect
                      placeholder={t('time-navigator.sparkline-sources', 'Sparkline source(s)')}
                      value={sourcePanelKeys}
                      options={panelOptions}
                      onChange={(vs) => model.setSourcePanels(vs.map((v) => v.value || '').filter(Boolean))}
                    />
                  </div>
                }
              >
                <IconButton name="graph-bar" tooltip={t('time-navigator.sparkline-sources', 'Sparkline source(s)')} />
              </Toggletip>
              <Toggletip
                placement="bottom-start"
                content={
                  <div style={{ width: 320 }}>
                    <MultiSelect
                      placeholder={t('time-navigator.annotation-queries', 'Annotation queries')}
                      value={annotationNames}
                      options={annotationOptions}
                      onChange={(vs) => model.setAnnotations(vs.map((v) => v.value || '').filter(Boolean))}
                    />
                  </div>
                }
              >
                <IconButton name="comment-alt" tooltip={t('time-navigator.annotation-queries', 'Annotation queries')} />
              </Toggletip>
            </>
          }
        />
      )}
    </div>
  );
}
