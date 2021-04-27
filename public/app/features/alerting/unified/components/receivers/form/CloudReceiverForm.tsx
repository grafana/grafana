import { AlertManagerCortexConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import React, { FC, useMemo } from 'react';
import { CloudChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { cloudNotifierTypes } from '../../../utils/cloud-alertmanager-notifier-types';
import { cloudReceiverToFormValues } from '../../../utils/receiver-form';
import { CloudCommonChannelSettings } from './CloudCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';

interface Props {
  alertManagerSourceName: string;
  config: AlertManagerCortexConfig;
  existing?: Receiver;
}

const defaultChannelValues: CloudChannelValues = Object.freeze({
  __id: '',
  sendResolved: true,
  secureSettings: {},
  settings: {},
  secureFields: {},
  type: 'email',
});

export const CloudReceiverForm: FC<Props> = ({ existing, alertManagerSourceName, config }) => {
  // transform receiver DTO to form values
  const [existingValue, id2original] = useMemo((): [
    ReceiverFormValues<CloudChannelValues> | undefined,
    Record<string, Record<string, unknown>>
  ] => {
    if (!existing) {
      return [undefined, {}];
    }
    return cloudReceiverToFormValues(existing, cloudNotifierTypes);
  }, [existing]);

  const onSubmit = (values: ReceiverFormValues<CloudChannelValues>) => {
    console.log('submit', values, id2original);
  };

  const takenReceiverNames = useMemo(
    () => config.alertmanager_config.receivers?.map(({ name }) => name).filter((name) => name !== existing?.name) ?? [],
    [config, existing]
  );

  return (
    <ReceiverForm<CloudChannelValues>
      onSubmit={onSubmit}
      initialValues={existingValue}
      notifiers={cloudNotifierTypes}
      alertManagerSourceName={alertManagerSourceName}
      defaultItem={defaultChannelValues}
      takenReceiverNames={takenReceiverNames}
      commonSettingsComponent={CloudCommonChannelSettings}
    />
  );
};
