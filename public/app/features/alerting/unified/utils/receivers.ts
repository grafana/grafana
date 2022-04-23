import { capitalize } from 'lodash';

import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaManagedReceiverConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { NotifierDTO } from 'app/types';

// extract notifier type name to count map, eg { Slack: 1, Email: 2 }

type NotifierTypeCounts = Record<string, number>; // name : count

export function extractNotifierTypeCounts(receiver: Receiver, grafanaNotifiers: NotifierDTO[]): NotifierTypeCounts {
  if (receiver['grafana_managed_receiver_configs']) {
    return getGrafanaNotifierTypeCounts(receiver.grafana_managed_receiver_configs ?? [], grafanaNotifiers);
  }
  return getCortexAlertManagerNotifierTypeCounts(receiver);
}

function getCortexAlertManagerNotifierTypeCounts(receiver: Receiver): NotifierTypeCounts {
  return Object.entries(receiver)
    .filter(([key]) => key !== 'grafana_managed_receiver_configs' && key.endsWith('_configs')) // filter out only properties that are alertmanager notifier
    .filter(([_, value]) => Array.isArray(value) && !!value.length) // check that there are actually notifiers of this type configured
    .reduce<NotifierTypeCounts>((acc, [key, value]) => {
      const type = key.replace('_configs', ''); // remove the `_config` part from the key, making it intto a notifier name
      const name = receiverTypeNames[type] ?? capitalize(type);
      return {
        ...acc,
        [name]: (acc[name] ?? 0) + (Array.isArray(value) ? value.length : 1),
      };
    }, {});
}

function getGrafanaNotifierTypeCounts(
  configs: GrafanaManagedReceiverConfig[],
  grafanaNotifiers: NotifierDTO[]
): NotifierTypeCounts {
  return configs
    .map((recv) => recv.type) // extract types from config
    .map((type) => grafanaNotifiers.find((r) => r.type === type)?.name ?? capitalize(type)) // get readable name from notifier cofnig, or if not available, just capitalize
    .reduce<NotifierTypeCounts>(
      (acc, type) => ({
        ...acc,
        [type]: (acc[type] ?? 0) + 1,
      }),
      {}
    );
}
