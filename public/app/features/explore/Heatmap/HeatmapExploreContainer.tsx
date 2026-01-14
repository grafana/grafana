import { createContext, useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  DataLinksContext,
  EventBus,
  LoadingState,
  SplitOpen,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';

import { useExploreDataLinkPostProcessor } from '../hooks/useExploreDataLinkPostProcessor';

// Context to provide splitOpen function to components that need to manually construct explore links
export const ExploreSplitOpenContext = createContext<{ splitOpen?: SplitOpen; timeRange?: TimeRange }>({});

interface Props {
  data: DataFrame[];
  annotations?: DataFrame[];
  height: number;
  width: number;
  timeRange: TimeRange;
  timeZone: TimeZone;
  loadingState: LoadingState;
  splitOpenFn: SplitOpen;
  onChangeTime?: (timeRange: AbsoluteTimeRange) => void;
  eventBus: EventBus;
}

export function HeatmapExploreContainer({
  data,
  annotations,
  height,
  width,
  timeZone,
  timeRange,
  onChangeTime,
  loadingState,
  splitOpenFn,
  eventBus,
}: Props) {
  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  const panelOptions = useMemo(
    () => ({
      calculate: false, // Data already in heatmap-cells format
      color: {
        scheme: 'Spectral',
        steps: 64,
      },
      tooltip: {
        mode: TooltipDisplayMode.Single,
        yHistogram: true,
        showColorScale: true,
      },
      legend: {
        show: true,
      },
      exemplars: {
        color: 'rgba(31, 120, 193, 0.7)', // Standard Grafana blue to match graph series
      },
    }),
    []
  );

  return (
    <DataLinksContext.Provider value={{ dataLinkPostProcessor }}>
      <ExploreSplitOpenContext.Provider value={{ splitOpen: splitOpenFn, timeRange }}>
        <PanelRenderer
          data={{
            series: data,
            annotations,
            timeRange,
            state: loadingState,
          }}
          pluginId="heatmap"
          title=""
          width={width}
          height={height}
          onChangeTimeRange={onChangeTime}
          timeZone={timeZone}
          options={panelOptions}
        />
      </ExploreSplitOpenContext.Provider>
    </DataLinksContext.Provider>
  );
}
