import { GrafanaManagedReceiverConfig } from '../../../../../../plugins/datasource/alertmanager/types';
import { OnCallIntegrationDTO } from '../../../api/onCallApi';
import { getIrmIfPresentOrOnCallPluginId, getIsIrmPluginPresent } from '../../../utils/config';
import { createBridgeURL } from '../../PluginBridge';

import { GRAFANA_APP_RECEIVERS_SOURCE_IMAGE } from './types';

export interface ReceiverPluginMetadata {
  icon: string;
  title: string;
  description?: string;
  externalUrl?: string;
  warning?: string;
}

const onCallReceiverICon = GRAFANA_APP_RECEIVERS_SOURCE_IMAGE[getIrmIfPresentOrOnCallPluginId()];
const onCallReceiverTitle = 'Grafana OnCall';

export const onCallReceiverMeta: ReceiverPluginMetadata = {
  title: onCallReceiverTitle,
  icon: onCallReceiverICon,
};

export function getOnCallMetadata(
  onCallIntegrations: OnCallIntegrationDTO[] | undefined | null,
  receiver: GrafanaManagedReceiverConfig,
  hasAlertManagerConfigData = true
): ReceiverPluginMetadata {
  const pluginName = getIsIrmPluginPresent() ? 'IRM' : 'OnCall';

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
      ? createBridgeURL(getIrmIfPresentOrOnCallPluginId(), `/integrations/${matchingOnCallIntegration.value}`)
      : undefined,
    warning: matchingOnCallIntegration ? undefined : `${pluginName} Integration no longer exists`,
  };
}
