import { get, has, isArray, isNil, omit, omitBy, reduce } from 'lodash';

import {
  AlertmanagerReceiver,
  GrafanaManagedContactPoint,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { CloudNotifierType, NotificationChannelOption, NotifierDTO, NotifierType } from 'app/types';

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
      ...omitTemporaryIdentifiers(settings),
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

  return values;
}

/**
 * Recursively find all keys that should be marked a secure fields, using JSONpath for nested fields.
 */
export function getSecureFieldNames(notifier: NotifierDTO): string[] {
  // eg. ['foo', 'bar.baz']
  const secureFieldPaths: string[] = [];

  // we'll pass in the prefix for each iteration so we can track the JSON path
  function findSecureOptions(options: NotificationChannelOption[], prefix?: string) {
    for (const option of options) {
      const key = prefix ? `${prefix}.${option.propertyName}` : option.propertyName;

      // if the field is a subform, recurse
      if (option.subformOptions) {
        findSecureOptions(option.subformOptions, key);
        continue;
      }

      if (option.secure) {
        secureFieldPaths.push(key);
        continue;
      }
    }
  }

  findSecureOptions(notifier.options);

  return secureFieldPaths;
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
      ...(existing && existing.type === values.type ? (existing.settings ?? {}) : {}),
      ...(values.settings ?? {}),
    }),
    secureSettings: omitEmptyUnlessExisting(values.secureSettings, existing?.secureFields),
    type: values.type,
    name,
    disableResolveMessage:
      values.disableResolveMessage ?? existing?.disableResolveMessage ?? defaults.disableResolveMessage,
  };

  // find all secure field definitions
  const secureFieldNames = notifier ? getSecureFieldNames(notifier) : [];

  // we make sure all fields that are marked as "secure" will be moved to "SecureSettings" instead of "settings"
  const secureSettings = reduce(
    secureFieldNames,
    (acc: Record<string, unknown> = {}, key) => {
      // the value for secure settings can come from either the "settings" (accidental) or "secureFields" if editing an existing receiver
      acc[key] = get(channel.settings, key) ?? get(values.secureFields, key);
      return acc;
    },
    {}
  );

  channel.secureSettings = {
    ...secureSettings,
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
  return omitBy(settings, (value, key) => isUnacceptableValue(value) && !has(existing, key));
}

export function omitTemporaryIdentifiers<T>(object: Readonly<T>): T {
  function omitIdentifiers<T>(obj: T) {
    if (isArray(obj)) {
      obj.forEach(omitIdentifiers);
    } else if (typeof obj === 'object' && obj !== null) {
      if ('__id' in obj) {
        delete obj.__id;
      }
      Object.values(obj).forEach(omitIdentifiers);
    }
  }

  const objectCopy = structuredClone(object);
  omitIdentifiers(objectCopy);

  return objectCopy;
}
