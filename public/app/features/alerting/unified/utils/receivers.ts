import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaManagedReceiverConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { NotifierDTO } from 'app/types';
import { capitalize } from 'lodash';

// extract readable notifier types that are in use for a receiver, eg ['Slack', 'Email', 'PagerDuty']
export function extractReadableNotifierTypes(receiver: Receiver, grafanaNotifiers: NotifierDTO[]): string[] {
  return [
    // grafana specific receivers
    ...getReadabaleGrafanaNotifierTypes(receiver.grafana_managed_receiver_configs ?? [], grafanaNotifiers),
    // cortex alert manager receivers
    ...getReadableCortexAlertManagerNotifierTypes(receiver),
  ];
}

function getReadableCortexAlertManagerNotifierTypes(receiver: Receiver): string[] {
  return Object.entries(receiver)
    .filter(([key]) => key !== 'grafana_managed_receiver_configs' && key.endsWith('_configs')) // filter out only properties that are alert manager notifier
    .filter(([_, value]) => Array.isArray(value) && !!value.length) // check that there are actually notifiers of this type configured
    .map(([key]) => key.replace('_configs', '')) // remove the `_config` part from the key, making it intto a notifier name
    .map((type) => receiverTypeNames[type] ?? capitalize(type)); // either map to readable name or, failing that, capitalize
}

function getReadabaleGrafanaNotifierTypes(
  configs: GrafanaManagedReceiverConfig[],
  grafanaNotifiers: NotifierDTO[]
): string[] {
  return configs
    .map((recv) => recv.type) // extract types from config
    .map((type) => grafanaNotifiers.find((r) => r.type === type)?.name ?? capitalize(type)); // get readable name from notifier cofnig, or if not available, just capitalize
}
