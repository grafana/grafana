import React, { useCallback, useState } from 'react';

import {
  DataFrame,
  EventBus,
  AbsoluteTimeRange,
  TimeZone,
  SplitOpen,
  LoadingState,
  ThresholdsConfig,
} from '@grafana/data';
import { GraphThresholdsStyleConfig, PanelChrome, PanelChromeProps } from '@grafana/ui';
import { ExploreGraphStyle } from 'app/types';

import { storeGraphStyle } from '../state/utils';

import { ExploreGraphLabel } from './ExploreGraphLabel';
import { MegaSelectGraph } from './MegaSelectGraph';
import { loadGraphStyle } from './utils';

interface Props extends Pick<PanelChromeProps, 'statusMessage'> {
  width: number;
  height: number;
  data: DataFrame[];
  annotations?: DataFrame[];
  eventBus: EventBus;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
  actionsOverride?: JSX.Element;
  megaSelectView?: string;
}

export const MegaSelectContainer = ({
  data,
  eventBus,
  height,
  width,
  absoluteRange,
  timeZone,
  annotations,
  onChangeTime,
  splitOpenFn,
  thresholdsConfig,
  thresholdsStyle,
  loadingState,
  statusMessage,
  actionsOverride,
  megaSelectView,
}: Props) => {
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);

  const getTitle = () => {
    if (megaSelectView) {
      return `${megaSelectView} by ${data[0]?.fields[1]?.labels?.__name__}`;
    }
    return undefined;
  };

  return (
    <PanelChrome
      title={getTitle()}
      width={width}
      height={height}
      loadingState={loadingState}
      statusMessage={statusMessage}
      actions={actionsOverride ?? <ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />}
    >
      {(innerWidth, innerHeight) => (
        <MegaSelectGraph
          graphStyle={graphStyle}
          data={data}
          height={innerHeight}
          width={innerWidth}
          absoluteRange={absoluteRange}
          onChangeTime={onChangeTime}
          timeZone={timeZone}
          annotations={annotations}
          splitOpenFn={splitOpenFn}
          loadingState={loadingState}
          thresholdsConfig={thresholdsConfig}
          thresholdsStyle={thresholdsStyle}
          eventBus={eventBus}
        />
      )}
    </PanelChrome>
  );
};
