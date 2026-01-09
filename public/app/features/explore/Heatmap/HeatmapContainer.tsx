import { useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataFrame,
  EventBus,
  LoadingState,
  SplitOpen,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelChrome, PanelChromeProps } from '@grafana/ui';

import { HeatmapExploreContainer } from './HeatmapExploreContainer';

const MAX_NUMBER_OF_HEATMAPS = 5;

interface Props extends Pick<PanelChromeProps, 'statusMessage'> {
  width: number;
  height: number;
  data: DataFrame[];
  eventBus: EventBus;
  timeRange: TimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
}

export const HeatmapContainer = ({
  data,
  eventBus,
  height,
  width,
  timeRange,
  timeZone,
  onChangeTime,
  splitOpenFn,
  loadingState,
  statusMessage,
}: Props) => {
  const slicedData = useMemo(() => {
    return data.slice(0, MAX_NUMBER_OF_HEATMAPS);
  }, [data]);

  return (
    <PanelChrome
      title={t('heatmap.container.title', 'Heatmap')}
      width={width}
      height={height}
      loadingState={loadingState}
      statusMessage={statusMessage}
    >
      {(innerWidth, innerHeight) => (
        <HeatmapExploreContainer
          data={slicedData}
          height={innerHeight}
          width={innerWidth}
          timeRange={timeRange}
          timeZone={timeZone}
          onChangeTime={onChangeTime}
          splitOpenFn={splitOpenFn}
          loadingState={loadingState}
          eventBus={eventBus}
        />
      )}
    </PanelChrome>
  );
};
