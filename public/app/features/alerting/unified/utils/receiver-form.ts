import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
  Route,
} from 'app/plugins/datasource/alertmanager/types';
import { NotifierDTO, NotifierType } from 'app/types';
import { GrafanaChannelValues, ReceiverFormValues } from '../types/receiver-form';

// id to notifier
type GrafanaChannelMap = Record<string, GrafanaManagedReceiverConfig>;

export function grafanaReceiverToFormValues(
  receiver: Receiver,
  notifiers: NotifierDTO[]
): [ReceiverFormValues<GrafanaChannelValues>, GrafanaChannelMap] {
  const channelMap: GrafanaChannelMap = {};
  // giving each form receiver item a unique id so we can use it to map back to "original" items
  // as well as to use as `key` prop.
  // @TODO use uid once backend is fixed to provide it. then we can get rid of the GrafanaChannelMap
  let idCounter = 1;
  const values = {
    name: receiver.name,
    items:
      receiver.grafana_managed_receiver_configs?.map((channel) => {
        const id = String(idCounter++);
        channelMap[id] = channel;
        const notifier = notifiers.find(({ type }) => type === channel.type);
        return grafanaChannelConfigToFormChannelValues(id, channel, notifier);
      }) ?? [],
  };
  return [values, channelMap];
}

export function formValuesToGrafanaReceiver(
  values: ReceiverFormValues<GrafanaChannelValues>,
  channelMap: GrafanaChannelMap,
  defaultChannelValues: GrafanaChannelValues
): Receiver {
  return {
    name: values.name,
    grafana_managed_receiver_configs: (values.items ?? []).map((channelValues) => {
      const existing: GrafanaManagedReceiverConfig | undefined = channelMap[channelValues.__id];
      return formChannelValuesToGrafanaChannelConfig(channelValues, defaultChannelValues, values.name, existing);
    }),
  };
}

// will add new receiver, or replace exisitng one
export function updateConfigWithReceiver(
  config: AlertManagerCortexConfig,
  receiver: Receiver,
  replaceReceiverName?: string
): AlertManagerCortexConfig {
  const oldReceivers = config.alertmanager_config.receivers ?? [];

  // sanity check that name is not duplicated
  if (receiver.name !== replaceReceiverName && !!oldReceivers.find(({ name }) => name === receiver.name)) {
    throw new Error(`Duplicate receiver name ${receiver.name}`);
  }

  // sanity check that existing receiver exists
  if (replaceReceiverName && !oldReceivers.find(({ name }) => name === replaceReceiverName)) {
    throw new Error(`Expected receiver ${replaceReceiverName} to exist, but did not find it in the config`);
  }

  const updated: AlertManagerCortexConfig = {
    ...config,
    alertmanager_config: {
      // @todo rename receiver on routes as necessary
      ...config.alertmanager_config,
      receivers: replaceReceiverName
        ? oldReceivers.map((existingReceiver) =>
            existingReceiver.name === replaceReceiverName ? receiver : existingReceiver
          )
        : [...oldReceivers, receiver],
    },
  };

  // if receiver was renamed, rename it in routes as well
  if (updated.alertmanager_config.route && replaceReceiverName && receiver.name !== replaceReceiverName) {
    updated.alertmanager_config.route = renameReceiverInRoute(
      updated.alertmanager_config.route,
      replaceReceiverName,
      receiver.name
    );
  }

  return updated;
}

function renameReceiverInRoute(route: Route, oldName: string, newName: string) {
  const updated: Route = {
    ...route,
  };
  if (updated.receiver === oldName) {
    updated.receiver = newName;
  }
  if (updated.routes) {
    updated.routes = updated.routes.map((route) => renameReceiverInRoute(route, oldName, newName));
  }
  return updated;
}

function grafanaChannelConfigToFormChannelValues(
  id: string,
  channel: GrafanaManagedReceiverConfig,
  notifier?: NotifierDTO
): GrafanaChannelValues {
  const values: GrafanaChannelValues = {
    __id: id,
    type: channel.type as NotifierType,
    uid: channel.uid,
    secureSettings: {},
    settings: { ...channel.settings },
    sendReminder: channel.sendReminder,
    secureFields: { ...channel.secureFields },
    disableResolveMessage: channel.disableResolveMessage,
  };

  // work around https://github.com/grafana/alerting-squad/issues/100
  notifier?.options.forEach((option) => {
    if (option.secure && values.settings[option.propertyName]) {
      delete values.settings[option.propertyName];
      values.secureFields[option.propertyName] = true;
    }
  });

  return values;
}

function formChannelValuesToGrafanaChannelConfig(
  values: GrafanaChannelValues,
  defaults: GrafanaChannelValues,
  name: string,
  existing?: GrafanaManagedReceiverConfig
): GrafanaManagedReceiverConfig {
  const channel: GrafanaManagedReceiverConfig = {
    settings: {
      ...(existing && existing.type === values.type ? existing.settings ?? {} : {}),
      ...(values.settings ?? {}),
    },
    secureSettings: values.secureSettings ?? {},
    type: values.type,
    sendReminder: values.sendReminder ?? existing?.sendReminder ?? defaults.sendReminder,
    name,
    disableResolveMessage:
      values.disableResolveMessage ?? existing?.disableResolveMessage ?? defaults.disableResolveMessage,
  };
  if (existing) {
    channel.uid = existing.uid;
  }
  return channel;
}
