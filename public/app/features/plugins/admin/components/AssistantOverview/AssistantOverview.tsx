import { type ReactNode } from 'react';

import { type GrafanaPlugin, PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_ONBOARDING_APP_ID } from 'app/core/appPluginIds';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../../state/hooks';
import { type CatalogPlugin } from '../../types';

import { type AssistantOverviewProps } from './constants';

const RELOAD_DELAY_MS = 1500;

interface AssistantJsonData {
  trialMode?: boolean;
  backendUrl?: string;
  isAccessTokenSet?: boolean;
}

function isAssistantJsonData(value: unknown): value is AssistantJsonData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (!('trialMode' in value) || typeof value.trialMode === 'boolean') &&
    (!('backendUrl' in value) || typeof value.backendUrl === 'string') &&
    (!('isAccessTokenSet' in value) || typeof value.isAccessTokenSet === 'boolean')
  );
}

interface Props {
  plugin: CatalogPlugin;
  pluginConfig?: GrafanaPlugin | null;
  pluginConfigLoading?: boolean;
  fallback: ReactNode;
}

export function AssistantOverview({ plugin, pluginConfig, pluginConfigLoading, fallback }: Props) {
  const installPlugin = useInstall();
  const { isInstalling } = useInstallStatus();
  const { components, isLoading: isLoadingOverview } = usePluginComponents<AssistantOverviewProps>({
    extensionPointId: PluginExtensionPoints.AssistantOnboardingOverview,
  });
  const jsonData = isAssistantJsonData(pluginConfig?.meta.jsonData) ? pluginConfig?.meta.jsonData : undefined;

  const overview = renderLimitedComponents<AssistantOverviewProps>({
    props: {
      isInstalled: plugin.isInstalled,
      isConnected: Boolean(jsonData?.trialMode || (jsonData?.backendUrl && jsonData.isAccessTokenSet)),
      isLoading: Boolean(pluginConfigLoading),
      isInstalling,
      canInstall: contextSrv.hasPermission(AccessControlAction.PluginsInstall),
      onInstall: async () => {
        const result = await installPlugin(plugin.id);
        if (!('error' in result)) {
          window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        }
      },
    },
    limit: 1,
    components,
    pluginId: ASSISTANT_ONBOARDING_APP_ID,
  });

  if (!overview) {
    return isLoadingOverview ? null : <>{fallback}</>;
  }

  return overview;
}
