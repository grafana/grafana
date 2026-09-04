import { useMemo, type CSSProperties } from 'react';

import { type DataFrame, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { type VizConfig, type VizPanel } from '@grafana/scenes';
import { useTheme2, type ElementSelectionContextState, ElementSelectionContext } from '@grafana/ui';

import { createDataGroups, FanoutDataGroup } from './FanoutByData';
import { createTimeWindowGroups, FanoutTimeWindowGroup } from './FanoutByTimeWindow';
import { defaultWindowCount, getTimeWindowFromMode } from './ViewPanelSidePane';

export type SplitGroup = DataSplitGroup | TimeWindowSplitGroup;

/**
 * Renders a slice of the data the panel has already fetched
 */
export interface DataSplitGroup {
  type: 'data';
  name: string;
  frames: DataFrame[];
}

/**
 * Re-runs the panel queries against a time range shifted back by one or more time windows
 */
export interface TimeWindowSplitGroup {
  type: 'timeWindow';
  name: string;
  timeShift: string;
  panel: VizPanel;
}

export function FanoutPanel({
  panel,
  panelDataIn,
  fanoutMode,
  windowCount,
}: {
  panel: VizPanel;
  panelDataIn: PanelData;
  fanoutMode?: string;
  windowCount?: number;
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

  /**
   * Memoized as the time window groups clone the panel, which we do not want to do on every render
   */
  const groups = useMemo(
    () => createFanoutGroups(panel, panelDataIn, fanoutMode, windowCount, theme),
    [panel, panelDataIn, fanoutMode, windowCount, theme]
  );

  const viz: VizConfig = {
    pluginId: panel.state.pluginId,
    pluginVersion: panel.state.pluginVersion ?? '0.0.0',
    options: {
      ...panel.state.options,
    },
    fieldConfig: panel.state.fieldConfig,
  };

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
        {groups.map((group, index) =>
          group.type === 'timeWindow' ? (
            <FanoutTimeWindowGroup key={index} group={group} viz={viz} />
          ) : (
            <FanoutDataGroup key={index} group={group} viz={viz} panelDataIn={panelDataIn} />
          )
        )}
      </div>
    </ElementSelectionContext.Provider>
  );
}

function createFanoutGroups(
  panel: VizPanel,
  data: PanelData,
  mode: string | undefined,
  windowCount: number | undefined,
  theme: GrafanaTheme2
): SplitGroup[] {
  const timeWindow = mode ? getTimeWindowFromMode(mode) : undefined;

  if (timeWindow) {
    return createTimeWindowGroups(panel, data, timeWindow, windowCount ?? defaultWindowCount);
  }

  return createDataGroups(panel, data, mode, theme);
}
