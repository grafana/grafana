import { useGetSingle } from 'app/features/plugins/admin/state/hooks';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { CatalogPlugin } from '../../../../../plugins/admin/types';

// can we assume this value will be always this one?
// ideally => BE returns this value
export const ONCALL_PLUGIN_ID = 'grafana-oncall-app';

export const useGetOnCallIsInstalledAndEnabled = () => {
  const plugin: CatalogPlugin | undefined = useGetSingle(ONCALL_PLUGIN_ID);
  return plugin?.isInstalled && !plugin?.isDisabled && plugin?.isPublished && plugin?.type === 'app'; // fetches the plugin settings for this Grafana instance
};

export const isInOnCallIntegrations = (url: string, integrationsUrls: string[]) => {
  return integrationsUrls.findIndex((integrationUrl) => integrationUrl === url) !== -1;
};

export const isOnCallReceiver = (receiver: Receiver, integrationsUrls: string[]) => {
  if (!receiver.grafana_managed_receiver_configs) {
    return false;
  }
  const onlyOneIntegration = receiver.grafana_managed_receiver_configs.length === 1;
  const isOncall = isInOnCallIntegrations(
    receiver.grafana_managed_receiver_configs[0]?.settings?.url ?? '',
    integrationsUrls
  );
  return onlyOneIntegration && isOncall;
};
