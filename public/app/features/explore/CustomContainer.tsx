import React, { useMemo } from 'react';

import { AbsoluteTimeRange, DataFrame, dateTime, EventBus, LoadingState, SplitOpen } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome, PanelContext, PanelContextProvider } from '@grafana/ui';

import { getPanelPluginMeta } from '../plugins/importPanelPlugin';

import { useExploreDataLinkPostProcessor } from './hooks/useExploreDataLinkPostProcessor';

export interface Props {
  width: number;
  height: number;
  timeZone: string;
  pluginId: string;
  frames: DataFrame[];
  absoluteRange: AbsoluteTimeRange;
  state: LoadingState;
  splitOpenFn: SplitOpen;
  eventBus: EventBus;
}

export function CustomContainer({
  width,
  height,
  timeZone,
  state,
  pluginId,
  frames,
  absoluteRange,
  splitOpenFn,
  eventBus,
}: Props) {
  const timeRange = useMemo(
    () => ({
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
      raw: {
        from: dateTime(absoluteRange.from),
        to: dateTime(absoluteRange.to),
      },
    }),
    [absoluteRange.from, absoluteRange.to]
  );

  const plugin = getPanelPluginMeta(pluginId);

  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  const panelContext: PanelContext = {
    dataLinkPostProcessor,
    eventBus,
    eventsScope: 'explore',
  };

  return (
    <PanelContextProvider value={panelContext}>
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
    </PanelContextProvider>
  );
}
