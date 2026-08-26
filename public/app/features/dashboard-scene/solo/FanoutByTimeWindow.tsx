import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { type AbsoluteTimeRange, type PanelData, type TimeRange, rangeUtil, toUtc } from '@grafana/data';
import { SceneTimeRange, type VizConfig, type VizPanel } from '@grafana/scenes';
import { SceneContext, SceneContextObject, useQueryRunner, VizPanel as VizPanelReact } from '@grafana/scenes-react';
import { useTheme2, type ElementSelectionContextState, ElementSelectionContext, Badge } from '@grafana/ui';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';

import { getQueryRunnerFor } from '../utils/utils';

import { FanoutByData } from './FanoutByData';

export function FanoutPanelByTimeWindow({
  panel,
  panelDataIn,
  fanoutByData,
  fanoutByTime,
}: {
  panel: VizPanel;
  panelDataIn: PanelData;
  fanoutByTime?: string;
  fanoutByData?: string;
}) {
  const theme = useTheme2();

  const selectionContext: ElementSelectionContextState = useMemo(() => {
    return {
      enabled: false,
      selected: [],
      onSelect: () => {},
      onClear: () => {},
    };
  }, []);

  if (!fanoutByTime) {
    return <FanoutByData panel={panel} panelDataIn={panelDataIn} fanoutMode={fanoutByData} />;
  }

  const groups = createTimeWindowGroups(panel, fanoutByTime);

  const style: CSSProperties = {
    display: 'grid',
    flexGrow: 1,
    gridTemplateColumns: `repeat(auto-fit, minmax(100%, 1fr))`,
    gridAutoRows: `minmax(250px, auto)`,
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(1),
    height: '100%',
  };

  return (
    <ElementSelectionContext.Provider value={selectionContext}>
      <div style={style}>
        {groups.map((group, index) => {
          if (index === 0) {
            return <FanoutByData key={index} panel={panel} panelDataIn={panelDataIn} fanoutMode={fanoutByData} />;
          }

          return <VizPanelTimeWindow key={index} group={group} />;
        })}
      </div>
    </ElementSelectionContext.Provider>
  );
}

interface SplitGroup {
  timeRange: TimeRange;
  timeShift: string;
  panel: VizPanel;
}

function createTimeWindowGroups(panel: VizPanel, timeWindow: string): SplitGroup[] {
  const windowCount = 5;
  const shiftAmountMs = rangeUtil.intervalToMs(timeWindow);
  const groups: SplitGroup[] = [];

  let timeRange = panel.getTimeRange();

  for (let index = 0; index < windowCount; index++) {
    if (index > 0) {
      timeRange = toTimeRange(getShiftedTimeRange(-1, timeRange, shiftAmountMs));
    }

    const newSceneTimeRange = new SceneTimeRange({});
    newSceneTimeRange.onTimeRangeChange(timeRange);

    groups.push({
      timeShift: index === 0 ? '' : `Time shifted -${index}${timeWindow}`,
      timeRange,
      panel:
        index === 0
          ? panel
          : panel.clone({
              $timeRange: newSceneTimeRange,
            }),
    });
  }

  return groups;
}

function toTimeRange({ from, to }: AbsoluteTimeRange): TimeRange {
  const fromUtc = toUtc(from);
  const toUtcValue = toUtc(to);

  return { from: fromUtc, to: toUtcValue, raw: { from: fromUtc, to: toUtcValue } };
}

function VizPanelTimeWindow({ group }: { group: SplitGroup }) {
  const context = useTimeWindowContext(group.panel);

  if (!context) {
    return null;
  }

  return (
    <SceneContext.Provider value={context}>
      <VizPanelReactWrapper group={group} />
    </SceneContext.Provider>
  );
}

function VizPanelReactWrapper({ group }: { group: SplitGroup }) {
  const viz: VizConfig = {
    pluginId: group.panel.state.pluginId,
    pluginVersion: group.panel.state.pluginVersion ?? '0.0.0',
    options: {
      ...group.panel.state.options,
    },
    fieldConfig: group.panel.state.fieldConfig,
  };

  const queryRunner = getQueryRunnerFor(group.panel);

  const data = useQueryRunner({
    queries: queryRunner?.state.queries ?? [],
    datasource: queryRunner?.state.datasource,
    minInterval: queryRunner?.state.minInterval,
  });

  return (
    <VizPanelReact
      title={group.panel.state.title}
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
