import { isEmpty, times } from 'lodash';

import { GrafanaManagedReceiverConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';

/**
 * This function will extract the integrations that have been defined for either grafana managed contact point
 * or vanilla Alertmanager receiver.
 *
 * It will attempt to normalize the data structure to how they have been defined for Grafana managed contact points.
 * That way we can work with the same data structure in the UI.
 *
 * We don't normalize the configuration settings and those are blank for vanilla Alertmanager receivers.
 *
 * Example input:
 *  { name: 'my receiver', email_configs: [{ from: "foo@bar.com" }] }
 *
 * Example output:
 *  { name: 'my receiver', grafana_managed_receiver_configs: [{ type: 'email', settings: {} }] }
 */
export function extractReceivers(receiver: Receiver): GrafanaManagedReceiverConfig[] {
  if ('grafana_managed_receiver_configs' in receiver) {
    return receiver.grafana_managed_receiver_configs ?? [];
  }

  const integrations = Object.entries(receiver)
    .filter(([key]) => key !== 'grafana_managed_receiver_configs' && key.endsWith('_configs'))
    .filter(([_, value]) => Array.isArray(value) && !isEmpty(value))
    .reduce((acc: GrafanaManagedReceiverConfig[], [key, value]) => {
      const type = key.replace('_configs', '');

      const configs = times(value.length, () => ({
        name: receiver.name,
        type: type,
        settings: [], // we don't normalize the configuration values
        disableResolveMessage: false,
      }));

      return acc.concat(configs);
    }, []);

  return integrations;
}
