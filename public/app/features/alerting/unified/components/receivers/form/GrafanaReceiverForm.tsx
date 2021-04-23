import { LoadingPlaceholder } from '@grafana/ui';
import { GrafanaManagedReceiverConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { NotifierDTO, NotifierType } from 'app/types';
import React, { FC, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { fetchGrafanaNotifiersAction } from '../../../state/actions';
import { GrafanaChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { ReceiverForm } from './ReceiverForm';

interface Props {
  alertManagerSourceName: string;
  existing?: Receiver;
}

const defaultChannelValues: GrafanaChannelValues = Object.freeze({
  sendReminder: true,
  secureSettings: {},
  settings: {},
  secureFields: {},
  disableResolveMessage: false,
  type: 'email',
});

export const GrafanaReceiverForm: FC<Props> = ({ existing, alertManagerSourceName }) => {
  const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!(grafanaNotifiers.result || grafanaNotifiers.loading)) {
      dispatch(fetchGrafanaNotifiersAction());
    }
  }, [grafanaNotifiers, dispatch]);

  // transform receiver DTO to form values
  const existingValue = useMemo((): ReceiverFormValues<GrafanaChannelValues> | undefined => {
    if (!existing) {
      return undefined;
    }
    return {
      name: existing.name,
      items:
        existing.grafana_managed_receiver_configs?.map((channel) => {
          const notifier = grafanaNotifiers?.result?.find(({ type }) => type === channel.type);
          return receiverConfigToFormValues(channel, notifier);
        }) ?? [],
    };
  }, [existing, grafanaNotifiers.result]);

  if (grafanaNotifiers.result) {
    return (
      <ReceiverForm<GrafanaChannelValues>
        existing={existingValue}
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
  channel: GrafanaManagedReceiverConfig,
  notifier?: NotifierDTO
): GrafanaChannelValues {
  const values: GrafanaChannelValues = {
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
