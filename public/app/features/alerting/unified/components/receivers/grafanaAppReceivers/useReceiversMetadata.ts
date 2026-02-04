import { useMemo } from 'react';

import { GrafanaManagedReceiverConfig } from '../../../../../../plugins/datasource/alertmanager/types';
import { OnCallIntegrationDTO } from '../../../api/onCallApi';
import { useIrmPlugin } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { createBridgeURL } from '../../PluginBridge';

import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from './types';

export interface ReceiverPluginMetadata {
  icon: string;
  title: string;
  description?: string;
  externalUrl?: string;
  warning?: string;
}

export function useOnCallMetadata(
  onCallIntegrations: OnCallIntegrationDTO[] | undefined | null,
  receiver: GrafanaManagedReceiverConfig,
  hasAlertManagerConfigData = true
): ReceiverPluginMetadata {
  const { pluginId } = useIrmPlugin(SupportedPlugin.OnCall);

  return useMemo(
    () => getOnCallMetadata(onCallIntegrations, receiver, hasAlertManagerConfigData, pluginId),
    [onCallIntegrations, receiver, hasAlertManagerConfigData, pluginId]
  );
}

export function getOnCallMetadata(
  onCallIntegrations: OnCallIntegrationDTO[] | undefined | null,
  receiver: GrafanaManagedReceiverConfig,
  hasAlertManagerConfigData = true,
  onCallPluginId?: SupportedPlugin
): ReceiverPluginMetadata {
  const pluginId = onCallPluginId || SupportedPlugin.OnCall;
  const pluginName = pluginId === SupportedPlugin.Irm ? 'IRM' : 'OnCall';
  const onCallReceiverIcon = GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[pluginId];
  const onCallReceiverTitle = pluginId === SupportedPlugin.Irm ? 'Grafana IRM' : 'Grafana OnCall';

  const onCallReceiverMeta: ReceiverPluginMetadata = {
    title: onCallReceiverTitle,
    icon: onCallReceiverIcon,
  };

  if (!hasAlertManagerConfigData) {
    return onCallReceiverMeta;
  }

  if (!receiver.settings?.url) {
    return onCallReceiverMeta;
  }

  // oncall status is still loading
  if (onCallIntegrations === undefined) {
    return onCallReceiverMeta;
  }

  // indication that onCall is not enabled
  if (onCallIntegrations == null) {
    return {
      ...onCallReceiverMeta,
      warning: `Grafana ${pluginName} is not installed or is disabled`,
    };
  }

  const matchingOnCallIntegration = onCallIntegrations.find(
    (integration) => integration.integration_url === receiver.settings?.url
  );

  return {
    ...onCallReceiverMeta,
    description: matchingOnCallIntegration?.display_name,
    externalUrl: matchingOnCallIntegration
      ? createBridgeURL(pluginId, `/integrations/${matchingOnCallIntegration.value}`)
      : undefined,
    warning: matchingOnCallIntegration ? undefined : `${pluginName} Integration no longer exists`,
  };
}
