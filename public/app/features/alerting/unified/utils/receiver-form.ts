import { isArray, omit, pick, isNil, omitBy } from 'lodash';

import {
  AlertManagerCortexConfig,
  AlertmanagerReceiver,
  GrafanaManagedContactPoint,
  GrafanaManagedReceiverConfig,
  Receiver,
  Route,
} from 'app/plugins/datasource/alertmanager/types';
import { CloudNotifierType, NotifierDTO, NotifierType } from 'app/types';

import {
  CloudChannelConfig,
  CloudChannelMap,
  CloudChannelValues,
  GrafanaChannelMap,
  GrafanaChannelValues,
  ReceiverFormValues,
} from '../types/receiver-form';

export function grafanaReceiverToFormValues(
  receiver: GrafanaManagedContactPoint,
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

export function cloudReceiverToFormValues(
  receiver: Receiver,
  notifiers: NotifierDTO[]
): [ReceiverFormValues<CloudChannelValues>, CloudChannelMap] {
  const channelMap: CloudChannelMap = {};
  // giving each form receiver item a unique id so we can use it to map back to "original" items
  let idCounter = 1;
  const items: CloudChannelValues[] = Object.entries(receiver)
    // filter out only config items that are relevant to cloud
    .filter(([type]) => type.endsWith('_configs') && type !== 'grafana_managed_receiver_configs')
    // map property names to cloud notifier types by removing the `_config` suffix
    .map(([type, configs]): [CloudNotifierType, CloudChannelConfig[]] => [
      type.replace('_configs', '') as CloudNotifierType,
      configs,
    ])
    // convert channel configs to form values
    .map(([type, configs]) =>
      configs.map((config) => {
        const id = String(idCounter++);
        channelMap[id] = { type, config };
        const notifier = notifiers.find((notifier) => notifier.type === type);
        if (!notifier) {
          throw new Error(`unknown cloud notifier: ${type}`);
        }
        return cloudChannelConfigToFormChannelValues(id, type, config);
      })
    )
    .flat();
  const values = {
    name: receiver.name,
    items,
  };
  return [values, channelMap];
}

export function formValuesToGrafanaReceiver(
  values: ReceiverFormValues<GrafanaChannelValues>,
  channelMap: GrafanaChannelMap,
  defaultChannelValues: GrafanaChannelValues,
  notifiers: NotifierDTO[]
): Receiver {
  return {
    name: values.name,
    grafana_managed_receiver_configs: (values.items ?? []).map((channelValues) => {
      const existing: GrafanaManagedReceiverConfig | undefined = channelMap[channelValues.__id];
      const notifier = notifiers.find((notifier) => notifier.type === channelValues.type);

      return formChannelValuesToGrafanaChannelConfig(
        channelValues,
        defaultChannelValues,
        values.name,
        existing,
        notifier
      );
    }),
  };
}

export function formValuesToCloudReceiver(
  values: ReceiverFormValues<CloudChannelValues>,
  defaults: CloudChannelValues
): Receiver {
  const recv: AlertmanagerReceiver = {
    name: values.name,
  };
  values.items.forEach(({ __id, type, settings, sendResolved }) => {
    const channel = omitEmptyValues({
      ...settings,
      send_resolved: sendResolved ?? defaults.sendResolved,
    });

    if (!(`${type}_configs` in recv)) {
      recv[`${type}_configs`] = [channel];
    } else {
      recv[`${type}_configs`]?.push(channel);
    }
  });
  return recv;
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

function cloudChannelConfigToFormChannelValues(
  id: string,
  type: CloudNotifierType,
  channel: CloudChannelConfig
): CloudChannelValues {
  return {
    __id: id,
    type,
    settings: {
      ...channel,
    },
    secureFields: {},
    secureSettings: {},
    sendResolved: channel.send_resolved,
  };
}

function grafanaChannelConfigToFormChannelValues(
  id: string,
  channel: GrafanaManagedReceiverConfig,
  notifier?: NotifierDTO
): GrafanaChannelValues {
  const values: GrafanaChannelValues = {
    __id: id,
    type: channel.type as NotifierType,
    provenance: channel.provenance,
    secureSettings: {},
    settings: { ...channel.settings },
    secureFields: { ...channel.secureFields },
    disableResolveMessage: channel.disableResolveMessage,
  };

  // work around https://github.com/grafana/alerting-squad/issues/100
  notifier?.options.forEach((option) => {
    if (option.secure && values.secureSettings[option.propertyName]) {
      delete values.settings[option.propertyName];
      values.secureFields[option.propertyName] = true;
    }
    if (option.secure && values.settings[option.propertyName]) {
      values.secureSettings[option.propertyName] = values.settings[option.propertyName];
      delete values.settings[option.propertyName];
    }
  });

  return values;
}

export function formChannelValuesToGrafanaChannelConfig(
  values: GrafanaChannelValues,
  defaults: GrafanaChannelValues,
  name: string,
  existing?: GrafanaManagedReceiverConfig,
  notifier?: NotifierDTO
): GrafanaManagedReceiverConfig {
  const channel: GrafanaManagedReceiverConfig = {
    settings: omitEmptyValues({
      ...(existing && existing.type === values.type ? existing.settings ?? {} : {}),
      ...(values.settings ?? {}),
    }),
    secureSettings: omitEmptyUnlessExisting(values.secureSettings, existing?.secureFields),
    type: values.type,
    name,
    disableResolveMessage:
      values.disableResolveMessage ?? existing?.disableResolveMessage ?? defaults.disableResolveMessage,
  };

  // find all secure field definitions
  const secureFieldNames: string[] =
    notifier?.options.filter((option) => option.secure).map((option) => option.propertyName) ?? [];

  // we make sure all fields that are marked as "secure" will be moved to "SecureSettings" instead of "settings"
  const shouldBeSecure = pick(channel.settings, secureFieldNames);
  channel.secureSettings = {
    ...shouldBeSecure,
    ...channel.secureSettings,
  };

  // remove the secure ones from the regular settings
  channel.settings = omit(channel.settings, secureFieldNames);

  if (existing) {
    channel.uid = existing.uid;
  }

  return channel;
}

// null, undefined and '' are deemed unacceptable
const isUnacceptableValue = (value: unknown) => isNil(value) || value === '';

// will remove properties that have empty ('', null, undefined) object properties.
// traverses nested objects and arrays as well. in place, mutates the object.
// this is needed because form will submit empty string for not filled in fields,
// but for cloud alertmanager receiver config to use global default value the property must be omitted entirely
// this isn't a perfect solution though. No way for user to intentionally provide an empty string. Will need rethinking later
export function omitEmptyValues<T>(obj: T): T {
  if (isArray(obj)) {
    obj.forEach(omitEmptyValues);
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (isUnacceptableValue(value)) {
        delete (obj as any)[key];
      } else {
        omitEmptyValues(value);
      }
    });
  }
  return obj;
}

// Will remove empty ('', null, undefined) object properties unless they were previously defined.
// existing is a map of property names that were previously defined.
export function omitEmptyUnlessExisting(settings = {}, existing = {}): Record<string, unknown> {
  return omitBy(settings, (value, key) => isUnacceptableValue(value) && !(key in existing));
}
