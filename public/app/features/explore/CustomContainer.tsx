import React from 'react';

import { AbsoluteTimeRange, DataFrame, dateTime, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';

import { getPanelPluginMeta } from '../plugins/importPanelPlugin';

export interface Props {
  width: number;
  height: number;
  timeZone: string;
  pluginId: string;
  frames: DataFrame[];
  absoluteRange: AbsoluteTimeRange;
  state: LoadingState;
}

export function CustomContainer({ width, height, timeZone, state, pluginId, frames, absoluteRange }: Props) {
  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  const plugin = getPanelPluginMeta(pluginId);

  return (
    <PanelChrome title={plugin.name} width={width} height={height} loadingState={state}>
      {(innerWidth, innerHeight) => (
        <PanelRenderer
          data={{ series: frames, state: state, timeRange }}
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
