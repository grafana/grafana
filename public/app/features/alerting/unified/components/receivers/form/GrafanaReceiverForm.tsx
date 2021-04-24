import { LoadingPlaceholder } from '@grafana/ui';
import {
  AlertManagerCortexConfig,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';
import { NotifierDTO, NotifierType } from 'app/types';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { fetchGrafanaNotifiersAction, updateAlertManagerConfigAction } from '../../../state/actions';
import { GrafanaChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { ReceiverForm } from './ReceiverForm';

interface Props {
  alertManagerSourceName: string;
  config: AlertManagerCortexConfig;
  existing?: Receiver;
}

const defaultChannelValues: GrafanaChannelValues = Object.freeze({
  __id: '',
  sendReminder: true,
  secureSettings: {},
  settings: {},
  secureFields: {},
  disableResolveMessage: false,
  type: 'email',
});

export const GrafanaReceiverForm: FC<Props> = ({ existing, alertManagerSourceName, config }) => {
  const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!(grafanaNotifiers.result || grafanaNotifiers.loading)) {
      dispatch(fetchGrafanaNotifiersAction());
    }
  }, [grafanaNotifiers, dispatch]);

  // transform receiver DTO to form values
  const [existingValue, id2original] = useMemo((): [
    ReceiverFormValues<GrafanaChannelValues> | undefined,
    Record<string, GrafanaManagedReceiverConfig>
  ] => {
    if (!existing) {
      return [undefined, {}];
    }
    const id2original: Record<string, GrafanaManagedReceiverConfig> = {};
    let idCounter = 1; // @TODO use uid once backend is fixed to return it
    const values = {
      name: existing.name,
      items:
        existing.grafana_managed_receiver_configs?.map((channel) => {
          const id = String(idCounter++);
          id2original[id] = channel;
          const notifier = grafanaNotifiers?.result?.find(({ type }) => type === channel.type);
          return receiverConfigToFormValues(id, channel, notifier);
        }) ?? [],
    };
    return [values, id2original];
  }, [existing, grafanaNotifiers.result]);

  // @TODO refactor a lot of this messy code into smaller well named util functions
  const onSubmit = (values: ReceiverFormValues<GrafanaChannelValues>) => {
    const newReceiver: Receiver = {
      name: values.name,
      grafana_managed_receiver_configs: (values.items ?? []).map((newChannelValues) => {
        const old: GrafanaManagedReceiverConfig | undefined = id2original[newChannelValues.__id];
        const channel: GrafanaManagedReceiverConfig = {
          settings: {
            ...(old?.settings ?? {}),
            ...(newChannelValues.settings ?? {}),
          },
          secureSettings: newChannelValues.secureSettings ?? {},
          type: newChannelValues.type,
          sendReminder: newChannelValues.sendReminder ?? old?.sendReminder ?? defaultChannelValues.sendReminder,
          name: values.name,
          disableResolveMessage:
            newChannelValues.disableResolveMessage ??
            old?.disableResolveMessage ??
            defaultChannelValues.disableResolveMessage,
        };
        if (old) {
          channel.uid = old.uid;
        }
        return channel;
      }),
    };
    const oldReceivers = config.alertmanager_config.receivers ?? [];
    const newConfig: AlertManagerCortexConfig = {
      ...config,
      alertmanager_config: {
        // @todo rename receiver on routes as necessary
        ...config.alertmanager_config,
        receivers: existing
          ? oldReceivers.map((recv) => (recv.name === existing.name ? newReceiver : recv))
          : [...oldReceivers, newReceiver],
      },
    };
    dispatch(
      updateAlertManagerConfigAction({
        newConfig,
        oldConfig: config,
        alertManagerSourceName: GRAFANA_RULES_SOURCE_NAME,
        successMessage: existing ? 'Receiver updated.' : 'Receiver created',
        redirectPath: '/alerting/notifications',
      })
    );
  };

  if (grafanaNotifiers.result) {
    return (
      <ReceiverForm<GrafanaChannelValues>
        onSubmit={onSubmit}
        initialValues={existingValue}
        notifiers={grafanaNotifiers.result}
        alertManagerSourceName={alertManagerSourceName}
        defaultItem={defaultChannelValues}
      />
    );
  } else {
    return <LoadingPlaceholder text="Loading notifiers..." />;
  }
};

function receiverConfigToFormValues(
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
