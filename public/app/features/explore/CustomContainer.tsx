import { DataFrame, DataLinksContext, EventBus, LoadingState, SplitOpen, TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { PanelRenderer } from '@grafana/runtime';
import { usePanelPluginMeta } from '@grafana/runtime/internal';
import { Alert, PanelChrome, ErrorWithStack } from '@grafana/ui';

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
  const { loading, error, value: plugin } = usePanelPluginMeta(pluginId);
  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <ErrorWithStack
        title={t('explore.custom-container.error-with-stack', 'Failed to get panel plugin')}
        error={error}
        errorInfo={{ componentStack: error?.stack ?? '' }}
      />
    );
  }

  if (!plugin) {
    return (
      <Alert title={t('explore.custom-container.title-find-plugin', 'Failed to find plugin')} severity="warning">
        <Trans i18nKey="explore.custom-container.body-find-plugin" values={{ pluginId: pluginId }}>
          Failed to find a panel plugin with the id <code>{'{{pluginId}}'}</code>.
        </Trans>
      </Alert>
    );
  }

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
