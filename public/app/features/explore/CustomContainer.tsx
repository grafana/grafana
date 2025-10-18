import { DataFrame, DataLinksContext, EventBus, LoadingState, SplitOpen, TimeRange } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';

import { getPanelPluginMeta } from '../plugins/importPanelPlugin';

import { useExploreDataLinkPostProcessor } from './hooks/useExploreDataLinkPostProcessor';

export interface Props {
  width: number;
  height: number;
  timeZone: string;
  pluginId: string;
  frames: DataFrame[];
  timeRange: TimeRange;
  state: LoadingState;
  splitOpenFn: SplitOpen;
  eventBus: EventBus;
}

export function CustomContainer({ width, height, timeZone, state, pluginId, frames, timeRange, splitOpenFn }: Props) {
  const plugin = getPanelPluginMeta(pluginId);

  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  return (
    <DataLinksContext.Provider value={{ dataLinkPostProcessor }}>
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
    </DataLinksContext.Provider>
  );
}
