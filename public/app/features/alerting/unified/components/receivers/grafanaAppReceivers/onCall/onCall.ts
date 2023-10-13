import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { OnCallIntegrationDTO } from '../../../../api/onCallApi';

// TODO This value needs to be changed to grafana_alerting when the OnCall team introduces the necessary changes
export const GRAFANA_ONCALL_INTEGRATION_TYPE = 'grafana_alerting';

export enum ReceiverTypes {
  OnCall = 'oncall',
}

export const isInOnCallIntegrations = (url: string, integrationsUrls: string[]) => {
  return integrationsUrls.includes(url);
};

export const isOnCallReceiver = (receiver: Receiver, integrations: OnCallIntegrationDTO[]) => {
  if (!receiver.grafana_managed_receiver_configs) {
    return false;
  }
  // A receiver it's an onCall contact point if it includes only one integration, and this integration it's an onCall
  // An integration it's an onCall type if it's included in the list of integrations returned by the onCall api endpoint
  const onlyOneIntegration = receiver.grafana_managed_receiver_configs.length === 1;
  const isOnCall = isInOnCallIntegrations(
    receiver.grafana_managed_receiver_configs[0]?.settings?.url ?? '',
    integrations.map((i) => i.integration_url)
  );
  return onlyOneIntegration && isOnCall;
};
