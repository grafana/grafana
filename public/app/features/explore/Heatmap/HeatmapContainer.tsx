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

// Fixed height for each heatmap panel
const HEATMAP_HEIGHT = 400;

interface Props extends Pick<PanelChromeProps, 'statusMessage'> {
  width: number;
  height: number;
  data: DataFrame[];
  annotations?: DataFrame[];
  eventBus: EventBus;
  timeRange: TimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
}

export const HeatmapContainer = ({
  data,
  annotations,
  eventBus,
  width,
  timeRange,
  timeZone,
  onChangeTime,
  splitOpenFn,
  loadingState,
  statusMessage,
}: Props) => {
  // Backend already respects query limit parameter, so render all frames
  return (
    <>
      {data.map((frame, index) => (
        <PanelChrome
          key={frame.name || `heatmap-${index}`}
          title={frame.name || t('heatmap.container.title', 'Heatmap')}
          width={width}
          height={HEATMAP_HEIGHT}
          loadingState={loadingState}
          statusMessage={statusMessage}
        >
          {(innerWidth, innerHeight) => (
            <HeatmapExploreContainer
              data={[frame]}
              annotations={annotations}
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
      ))}
    </>
  );
};
