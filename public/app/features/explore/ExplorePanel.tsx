import React from 'react';

import { AbsoluteTimeRange, DataFrame, dateTime, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';

export interface Props {
  width: number;
  height: number;
  timeZone: string;
  frame: DataFrame;
  absoluteRange: AbsoluteTimeRange;
  state: LoadingState;
}

export function ExplorePanel({ width, height, timeZone, state, frame, absoluteRange }: Props) {
  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  let title = 'Custom Panel';
  if (frame.meta?.custom?.title) {
    title = frame.meta?.custom?.title;
  }

  let pluginId = 'table';
  if (frame.meta?.custom?.pluginID) {
    pluginId = frame.meta?.custom?.pluginID;
  }

  return (
    <PanelChrome title={title} width={width} height={height} loadingState={state}>
      {(innerWidth, innerHeight) => (
        <PanelRenderer
          data={{ series: [frame], state: state, timeRange }}
          pluginId={pluginId}
          title=""
          width={innerWidth}
          height={innerHeight}
          timeZone={timeZone}
        />
      )}
    </PanelChrome>
  );
}
