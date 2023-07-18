import React from 'react';

import { AbsoluteTimeRange, DataFrame, dateTime, EventBus, LoadingState, SplitOpen } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome, PanelContext, PanelContextProvider } from '@grafana/ui';

import { getPanelPluginMeta } from '../plugins/importPanelPlugin';

import { useExploreInternalDataLinkSupplier } from './hooks/useExploreDataLinksSupplier';

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
  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  const plugin = getPanelPluginMeta(pluginId);

  const internalDataLinkSupplier = useExploreInternalDataLinkSupplier(splitOpenFn, timeRange);

  const panelContext: PanelContext = {
    internalDataLinkSupplier,
    eventBus,
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
