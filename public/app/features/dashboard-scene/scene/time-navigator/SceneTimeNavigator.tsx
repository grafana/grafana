import { debounce } from 'lodash';
import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { type DataFrame, dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  type SceneDataProvider,
  SceneObjectBase,
  type SceneObjectState,
  SceneQueryRunner,
  SceneTimeRange,
  sceneGraph,
} from '@grafana/scenes';
import { Select } from '@grafana/ui';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from '../../utils/getDatasourceFromQueryRunner';
import { findVizPanelByKey, getDashboardSceneFor, getQueryRunnerFor } from '../../utils/utils';

import { TimeBar } from './TimeBar';
import { CONTEXT_ZOOM_FACTOR, type TimeRangeMs } from './timeModel';

const EMPTY: number[] = [];
/** Downsample target for the background sparkline query (resolution for the bar). */
const SPARKLINE_MAX_DATA_POINTS = 100;

export interface SceneTimeNavigatorState extends SceneObjectState {
  height?: number;
  contextZoomFactor?: number;
  /** Key of the dashboard panel whose queries feed the background sparkline (a live reference). */
  sourcePanelKey?: string;
  /** Our own query runner for the sparkline, scoped to the context window (see _contextRange). */
  $data?: SceneDataProvider;
}

/**
 * A dashboard control that renders the timebar (a zoomed-out context window with a brushed selection that
 * drives the dashboard time range) with an optional background sparkline. The sparkline reuses another
 * panel's queries (by key), but re-runs them against the *context window* — its own SceneTimeRange, wider
 * than the dashboard/selection range — with its own downsampling, so it can render across the whole bar.
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
    // Default the sparkline source to the first panel that has queries, if none is chosen yet.
    if (!this.state.sourcePanelKey) {
      const dashboard = getDashboardSceneFor(this);
      const firstWithQueries = dashboardSceneGraph.getVizPanels(dashboard).find((p) => getQueryRunnerFor(p));
      if (firstWithQueries?.state.key) {
        this.setState({ sourcePanelKey: firstWithQueries.state.key });
      }
    }
    this._applySourcePanel();
  }

  private _applySourcePanel() {
    const runner = this.state.$data;
    if (!(runner instanceof SceneQueryRunner)) {
      return;
    }
    const dashboard = getDashboardSceneFor(this);
    const panel = this.state.sourcePanelKey ? findVizPanelByKey(dashboard, this.state.sourcePanelKey) : null;
    const source = getQueryRunnerFor(panel ?? undefined);
    runner.setState({
      queries: source?.state.queries ?? [],
      datasource: (source && getDatasourceFromQueryRunner(source)) || undefined,
    });
    runner.runQueries();
  }

  /** Choose which panel's queries feed the sparkline. */
  public setSourcePanel(key: string | undefined) {
    this.setState({ sourcePanelKey: key });
    this._applySourcePanel();
  }

  /** Update the range the sparkline is queried over (the context window). Caller debounces. */
  public setContextRange({ from, to }: TimeRangeMs) {
    const f = dateTime(from);
    const to2 = dateTime(to);
    this._contextRange.onTimeRangeChange({ from: f, to: to2, raw: { from: f, to: to2 } });
  }
}

function extractSparkline(series: DataFrame[] | undefined): { time: number[]; values: number[] } {
  const frame = series?.[0];
  if (!frame) {
    return { time: EMPTY, values: EMPTY };
  }
  const timeField = frame.fields.find((f) => f.type === 'time');
  const valueField = frame.fields.find((f) => f.type === 'number');
  return { time: timeField?.values ?? EMPTY, values: valueField?.values ?? EMPTY };
}

function SceneTimeNavigatorRenderer({ model }: SceneComponentProps<SceneTimeNavigator>) {
  const { height = 88, contextZoomFactor = CONTEXT_ZOOM_FACTOR, sourcePanelKey } = model.useState();
  const { value } = sceneGraph.getTimeRange(model).useState();
  const { data } = sceneGraph.getData(model).useState();
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const spark = extractSparkline(data?.series);

  // Debounce re-querying so a zoom/pan gesture doesn't fire a query per tick.
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
            <Select
              width={24}
              placeholder={t('time-navigator.sparkline-source', 'Sparkline source')}
              value={sourcePanelKey}
              options={panelOptions}
              onChange={(v) => model.setSourcePanel(v?.value || undefined)}
            />
          }
        />
      )}
    </div>
  );
}
