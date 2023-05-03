import React, { useMemo } from 'react';

import { Alert } from '@grafana/ui';
import { AlertManagerCortexConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { updateAlertManagerConfigAction } from '../../../state/actions';
import { CloudChannelValues, ReceiverFormValues, CloudChannelMap } from '../../../types/receiver-form';
import { cloudNotifierTypes } from '../../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import {
  cloudReceiverToFormValues,
  formValuesToCloudReceiver,
  updateConfigWithReceiver,
} from '../../../utils/receiver-form';

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

export const CloudReceiverForm = ({ existing, alertManagerSourceName, config }: Props) => {
  const dispatch = useDispatch();
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);

  // transform receiver DTO to form values
  const [existingValue] = useMemo((): [ReceiverFormValues<CloudChannelValues> | undefined, CloudChannelMap] => {
    if (!existing) {
      return [undefined, {}];
    }
    return cloudReceiverToFormValues(existing, cloudNotifierTypes);
  }, [existing]);

  const onSubmit = (values: ReceiverFormValues<CloudChannelValues>) => {
    const newReceiver = formValuesToCloudReceiver(values, defaultChannelValues);
    dispatch(
      updateAlertManagerConfigAction({
        newConfig: updateConfigWithReceiver(config, newReceiver, existing?.name),
        oldConfig: config,
        alertManagerSourceName,
        successMessage: existing ? 'Contact point updated.' : 'Contact point created.',
        redirectPath: '/alerting/notifications',
      })
    );
  };

  const takenReceiverNames = useMemo(
    () => config.alertmanager_config.receivers?.map(({ name }) => name).filter((name) => name !== existing?.name) ?? [],
    [config, existing]
  );

  // this basically checks if we can manage the selected alert manager data source, either because it's a Grafana Managed one
  // or a Mimir-based AlertManager
  const isManageableAlertManagerDataSource = !isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);

  return (
    <>
      {!isVanillaAM && (
        <Alert title="Info" severity="info">
          Note that empty string values will be replaced with global defaults where appropriate.
        </Alert>
      )}
      <ReceiverForm<CloudChannelValues>
        isEditable={isManageableAlertManagerDataSource}
        isTestable={isManageableAlertManagerDataSource}
        config={config}
        onSubmit={onSubmit}
        initialValues={existingValue}
        notifiers={cloudNotifierTypes}
        alertManagerSourceName={alertManagerSourceName}
        defaultItem={defaultChannelValues}
        takenReceiverNames={takenReceiverNames}
        commonSettingsComponent={CloudCommonChannelSettings}
      />
    </>
  );
};
