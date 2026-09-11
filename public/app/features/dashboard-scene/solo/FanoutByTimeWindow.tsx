import { useEffect, useState } from 'react';

import { type AbsoluteTimeRange, type PanelData, type TimeRange, rangeUtil, toUtc } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneTimeRange, type VizConfig, type VizPanel } from '@grafana/scenes';
import { SceneContext, SceneContextObject, useQueryRunner, VizPanel as VizPanelReact } from '@grafana/scenes-react';
import { Badge } from '@grafana/ui';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';

import { getQueryRunnerFor } from '../utils/utils';

import { type SplitGroup, type TimeWindowSplitGroup } from './FanoutPanel';

export function createTimeWindowGroups(
  panel: VizPanel,
  data: PanelData,
  timeWindow: string,
  windowCount: number
): SplitGroup[] {
  // Time window is normally just a unit (h, d, w, M) which needs a count to be a valid interval string
  const shiftAmountMs = rangeUtil.intervalToMs(/^\d/.test(timeWindow) ? timeWindow : `1${timeWindow}`);

  /**
   * The most recent window is the panel time range unmodified, so we can render the data the panel already has
   */
  const groups: SplitGroup[] = [{ type: 'data', name: panel.state.title, frames: data.series }];

  let timeRange = panel.getTimeRange();

  for (let index = 1; index <= windowCount; index++) {
    timeRange = toTimeRange(getShiftedTimeRange(-1, timeRange, shiftAmountMs));

    const shiftedTimeRange = new SceneTimeRange({});
    shiftedTimeRange.onTimeRangeChange(timeRange);

    groups.push({
      type: 'timeWindow',
      name: panel.state.title,
      timeShift: t('dashboard.fanout-by-time.time-shift-badge', 'Time shifted -{{shift}}', {
        shift: `${index}${timeWindow}`,
      }),
      panel: panel.clone({ $timeRange: shiftedTimeRange }),
    });
  }

  return groups;
}

function toTimeRange({ from, to }: AbsoluteTimeRange): TimeRange {
  const fromUtc = toUtc(from);
  const toUtcValue = toUtc(to);

  return { from: fromUtc, to: toUtcValue, raw: { from: fromUtc, to: toUtcValue } };
}

export function FanoutTimeWindowGroup({ group, viz }: { group: TimeWindowSplitGroup; viz: VizConfig }) {
  const context = useTimeWindowContext(group.panel);

  if (!context) {
    return null;
  }

  return (
    <SceneContext.Provider value={context}>
      <TimeWindowQuery group={group} viz={viz} />
    </SceneContext.Provider>
  );
}

function TimeWindowQuery({ group, viz }: { group: TimeWindowSplitGroup; viz: VizConfig }) {
  const queryRunner = getQueryRunnerFor(group.panel);

  const data = useQueryRunner({
    queries: queryRunner?.state.queries ?? [],
    datasource: queryRunner?.state.datasource,
    minInterval: queryRunner?.state.minInterval,
  });

  return (
    <VizPanelReact
      title={group.name}
      viz={viz}
      dataProvider={data}
      headerActions={<Badge color="blue" text={group.timeShift} />}
    />
  );
}

function useTimeWindowContext(panel: VizPanel): SceneContextObject | null {
  const [context, setContext] = useState<SceneContextObject | null>(null);

  /**
   * Attach SceneContextObject to the panel on mount for any dynamically rendered scenes-react panels
   */
  useEffect(() => {
    const newContext = new SceneContextObject();
    // @ts-expect-error
    panel.setState({ context: newContext });
    setContext(newContext);

    return () => {
      // @ts-expect-error
      panel.setState({ context: null });
      setContext(null);
    };
  }, [panel]);

  return context;
}
