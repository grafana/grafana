import { debounce } from 'lodash';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { type DataFrame, type DataSourceRef, dateTime, outerJoinDataFrames, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  dataLayers,
  type SceneComponentProps,
  SceneDataLayerSet,
  type SceneDataProvider,
  type SceneDataQuery,
  SceneObjectBase,
  type SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  sceneGraph,
} from '@grafana/scenes';
import { type AnnotationQuery } from '@grafana/schema';
import { IconButton, MultiSelect, Toggletip } from '@grafana/ui';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../../utils/getDatasourceFromQueryRunner';
import { findVizPanelByKey, getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';
import { DashboardAnnotationsDataLayer } from '../DashboardAnnotationsDataLayer';

import { TimeBar } from './TimeBar';
import { CONTEXT_ZOOM_FACTOR, type TimeRangeMs } from './timeModel';

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
  /** Fresh annotation layers scoped to the context window; kept in state so they're parented into the
   * scene graph — their queries enrich the request with the dashboard by walking up to it. */
  annotationSet?: SceneDataLayerSet;
  /** Our own query runner for the sparklines, scoped to the context window (see _contextRange). */
  $data?: SceneDataProvider;
}

/**
 * A dashboard control that renders the timebar (a zoomed-out context window with a brushed selection that
 * drives the dashboard time range) with optional background sparklines. The sparklines reuse other panels'
 * queries (by key) but re-run them against the *context window* — its own SceneTimeRange, wider than the
 * dashboard/selection range — with its own downsampling, so they render across the whole bar.
 */
export class SceneTimeNavigator extends SceneObjectBase<SceneTimeNavigatorState> {
  public static Component = SceneTimeNavigatorRenderer;

  /** The range the sparkline query runs against — the context window, independent of the dashboard time. */
  private _contextRange: SceneTimeRange;
  /** The same context window for the annotation layers (a separate instance to avoid a shared parent). */
  private _annoRange: SceneTimeRange;
  /** Teardown for the current annotation layer set's activation + subscription. */
  private _annoCleanup?: () => void;

  public constructor(state: Partial<SceneTimeNavigatorState> = {}) {
    const contextRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
    super({
      ...state,
      $data: new SceneQueryRunner({ queries: [], maxDataPoints: SPARKLINE_MAX_DATA_POINTS, $timeRange: contextRange }),
    });
    this._contextRange = contextRange;
    this._annoRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
    this.addActivationHandler(() => this._activationHandler());
  }

  /** Per-dashboard localStorage key for a saved selection. */
  private _storageKey(kind: 'sources' | 'annotations'): string | undefined {
    const uid = getDashboardSceneFor(this).state.uid;
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
    this._applySources();
    this._applyAnnotations();
    return () => this._annoCleanup?.();
  }

  /**
   * Re-run the selected dashboard annotation queries over the context window and expose the resulting
   * frames for the bar. We build FRESH layers from the chosen query defs (reusing the live dashboard
   * layers would repoint the range the dashboard panels resolve) nested under a SceneDataLayerSet that
   * carries our own context SceneTimeRange, so markers span the whole bar. The set is kept in state so
   * it is parented into the scene graph — annotation queries enrich their request with the dashboard by
   * walking up to it.
   */
  private _applyAnnotations() {
    this._annoCleanup?.();
    this._annoCleanup = undefined;

    const names = new Set(this.state.annotationNames ?? []);
    let queries: AnnotationQuery[] = [];
    if (names.size) {
      try {
        queries = dashboardSceneGraph
          .getDataLayers(getDashboardSceneFor(this))
          .state.annotationLayers.filter(
            (l): l is dataLayers.AnnotationsDataLayer => l instanceof dataLayers.AnnotationsDataLayer
          )
          .map((l) => l.state.query)
          .filter((q) => names.has(q.name));
      } catch {
        queries = [];
      }
    }
    if (!queries.length) {
      this.setState({ annotations: [], annotationSet: undefined });
      return;
    }

    const layers = queries.map(
      (query) => new DashboardAnnotationsDataLayer({ query, name: query.name, isEnabled: true })
    );
    // NB: SceneDataLayerSet's constructor only forwards { name, layers } to super, so a $timeRange passed
    // to the constructor is dropped. Set it afterwards so the layers resolve OUR context window (not the
    // dashboard range) when they walk up the graph for their time range.
    const set = new SceneDataLayerSet({ layers });
    set.setState({ $timeRange: this._annoRange });
    this.setState({ annotationSet: set });
    const deactivate = set.activate();
    const sub = set.getResultsStream().subscribe((res) => {
      this.setState({ annotations: res.data.series ?? [] });
    });
    this._annoCleanup = () => {
      sub.unsubscribe();
      deactivate();
    };
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
    const dashboard = getDashboardSceneFor(this);
    const queries: SceneDataQuery[] = [];
    for (const key of this.state.sourcePanelKeys ?? []) {
      const source = getQueryRunnerFor(findVizPanelByKey(dashboard, key) ?? undefined);
      if (!source) {
        continue;
      }
      const ds = getDatasourceFromQueryRunner(source);
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
    const f = dateTime(from);
    const to2 = dateTime(to);
    const range = { from: f, to: to2, raw: { from: f, to: to2 } };
    this._contextRange.onTimeRangeChange(range);
    this._annoRange.onTimeRangeChange(range);
  }
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

  const dashboard = getDashboardSceneFor(model);
  const panelOptions = dashboardSceneGraph.getVizPanels(dashboard).map((p) => ({
    label: p.state.title || p.state.key || '',
    value: p.state.key || '',
  }));
  let annotationOptions: Array<{ label: string; value: string }> = [];
  try {
    annotationOptions = dashboardSceneGraph
      .getDataLayers(dashboard)
      .state.annotationLayers.map((l) => ({ label: l.state.name ?? '', value: l.state.name ?? '' }));
  } catch {
    // No annotation layers on this scene — leave the picker empty.
  }

  return (
    <div ref={ref} style={{ width: '100%', minHeight: height }}>
      {width > 0 && (
        <TimeBar
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
