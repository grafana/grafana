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
import { Collapse, GraphThresholdsStyleConfig, useTheme2 } from '@grafana/ui';
import { ExploreGraphStyle } from 'app/types';

import { storeGraphStyle } from '../state/utils';

import { ExploreGraph } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { loadGraphStyle } from './utils';

interface Props {
  loading: boolean;
  data: DataFrame[];
  annotations?: DataFrame[];
  eventBus: EventBus;
  height: number;
  width: number;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
}

export const GraphContainer = ({
  loading,
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
}: Props) => {
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
  const theme = useTheme2();
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);

  return (
    <Collapse
      label={<ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />}
      loading={loading}
      isOpen
    >
      <ExploreGraph
        graphStyle={graphStyle}
        data={data}
        height={height}
        width={width - spacing}
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
    </Collapse>
  );
};
