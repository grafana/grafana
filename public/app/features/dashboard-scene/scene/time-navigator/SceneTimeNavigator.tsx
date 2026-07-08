import { debounce } from 'lodash';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { type DataFrame, type DataSourceRef, dateTime, outerJoinDataFrames } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  type SceneDataProvider,
  type SceneDataQuery,
  SceneObjectBase,
  type SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  sceneGraph,
} from '@grafana/scenes';
import { IconButton, MultiSelect, Toggletip } from '@grafana/ui';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../../utils/getDatasourceFromQueryRunner';
import { findVizPanelByKey, getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';

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

  public constructor(state: Partial<SceneTimeNavigatorState> = {}) {
    const contextRange = new SceneTimeRange({ from: 'now-6h', to: 'now' });
    super({
      ...state,
      $data: new SceneQueryRunner({ queries: [], maxDataPoints: SPARKLINE_MAX_DATA_POINTS, $timeRange: contextRange }),
    });
    this._contextRange = contextRange;
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    // Default to the first panel that has queries, if none is chosen yet.
    if (!this.state.sourcePanelKeys?.length) {
      const dashboard = getDashboardSceneFor(this);
      const first = dashboardSceneGraph.getVizPanels(dashboard).find((p) => getQueryRunnerFor(p));
      if (first?.state.key) {
        this.setState({ sourcePanelKeys: [first.state.key] });
      }
    }
    this._applySources();
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
    this._applySources();
  }

  /** Update the range the sparklines are queried over (the context window). Caller debounces. */
  public setContextRange({ from, to }: TimeRangeMs) {
    const f = dateTime(from);
    const to2 = dateTime(to);
    this._contextRange.onTimeRangeChange({ from: f, to: to2, raw: { from: f, to: to2 } });
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
  const { height = 88, contextZoomFactor = CONTEXT_ZOOM_FACTOR, sourcePanelKeys } = model.useState();
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

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && (
        <TimeBar
          value={{ from: value.from.valueOf(), to: value.to.valueOf() }}
          now={Date.now()}
          width={width}
          height={height}
          time={spark.time}
          values={spark.values}
          contextZoomFactor={contextZoomFactor}
          onChangeTimeRange={(range) => {
            const from = dateTime(range.from);
            const to = dateTime(range.to);
            sceneGraph.getTimeRange(model).onTimeRangeChange({ from, to, raw: { from, to } });
          }}
          onContextWindowChange={onContextWindowChange}
          extraControls={
            <Toggletip
              placement="bottom-start"
              content={
                <div style={{ width: 320 }}>
                  <MultiSelect
                    menuShouldPortal={false}
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
          }
        />
      )}
    </div>
  );
}
