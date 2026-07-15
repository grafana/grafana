import { type ReactNode } from 'react';

import { type GrafanaPlugin } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../../state/hooks';
import { type CatalogPlugin } from '../../types';

import { ASSISTANT_ONBOARDING_OVERVIEW_COMPONENT_ID, type AssistantOverviewProps } from './constants';

const RELOAD_DELAY_MS = 1500;

interface AssistantJsonData {
  trialMode?: boolean;
  backendUrl?: string;
  isAccessTokenSet?: boolean;
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
  const { component: AssistantOnboardingOverview, isLoading: isLoadingOverview } =
    usePluginComponent<AssistantOverviewProps>(ASSISTANT_ONBOARDING_OVERVIEW_COMPONENT_ID);
  const jsonData = pluginConfig?.meta.jsonData as AssistantJsonData | undefined;

  if (!AssistantOnboardingOverview) {
    return isLoadingOverview ? null : <>{fallback}</>;
  }

  return (
    <AssistantOnboardingOverview
      isInstalled={plugin.isInstalled}
      isConnected={Boolean(jsonData?.trialMode || (jsonData?.backendUrl && jsonData.isAccessTokenSet))}
      isLoading={Boolean(pluginConfigLoading)}
      isInstalling={isInstalling}
      canInstall={contextSrv.hasPermission(AccessControlAction.PluginsInstall)}
      onInstall={async () => {
        const result = await installPlugin(plugin.id);
        if (!('error' in result)) {
          window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        }
      }}
    />
  );
}
