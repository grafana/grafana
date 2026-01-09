import { useMemo } from 'react';

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

interface Props {
  data: DataFrame[];
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
    }),
    []
  );

  return (
    <DataLinksContext.Provider value={{ dataLinkPostProcessor }}>
      <PanelRenderer
        data={{
          series: data,
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
    </DataLinksContext.Provider>
  );
}
