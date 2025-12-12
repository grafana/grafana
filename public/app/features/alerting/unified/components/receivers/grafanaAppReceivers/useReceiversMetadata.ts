import { t } from '@grafana/i18n';
import { UseIsIrmConfig } from 'app/features/gops/configuration-tracker/irmHooks';

import { GrafanaManagedReceiverConfig } from '../../../../../../plugins/datasource/alertmanager/types';
import { OnCallIntegrationDTO } from '../../../api/onCallApi';
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

export const onCallReceiverMeta = (pluginId: SupportedPlugin): ReceiverPluginMetadata => ({
  title: t('alerting.on-call-receiver-meta.title.grafana-on-call', 'Grafana OnCall'),
  icon: GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[pluginId],
});

export function getOnCallMetadata(
  onCallIntegrations: OnCallIntegrationDTO[] | undefined | null,
  receiver: GrafanaManagedReceiverConfig,
  hasAlertManagerConfigData = true,
  irmConfig: UseIsIrmConfig
): ReceiverPluginMetadata {
  const pluginName = irmConfig.isIrmPluginPresent ? 'IRM' : 'OnCall';
  const pluginId = irmConfig.onCallPluginId;

  if (!hasAlertManagerConfigData) {
    return onCallReceiverMeta(pluginId);
  }

  if (!receiver.settings?.url) {
    return onCallReceiverMeta(pluginId);
  }

  // oncall status is still loading
  if (onCallIntegrations === undefined) {
    return onCallReceiverMeta(pluginId);
  }

  // indication that onCall is not enabled
  if (onCallIntegrations == null) {
    return {
      ...onCallReceiverMeta(pluginId),
      warning: `Grafana ${pluginName} is not installed or is disabled`,
    };
  }

  const matchingOnCallIntegration = onCallIntegrations.find(
    (integration) => integration.integration_url === receiver.settings?.url
  );

  return {
    ...onCallReceiverMeta(pluginId),
    description: matchingOnCallIntegration?.display_name,
    externalUrl: matchingOnCallIntegration
      ? createBridgeURL(pluginId, `/integrations/${matchingOnCallIntegration.value}`)
      : undefined,
    warning: matchingOnCallIntegration ? undefined : `${pluginName} Integration no longer exists`,
  };
}
