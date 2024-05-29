import React, { useMemo } from 'react';
import { useHistory } from 'react-router-dom';

import { Alert } from '@grafana/ui';
import { AlertManagerCortexConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';

import { CloudChannelValues, ReceiverFormValues, CloudChannelMap } from '../../../types/receiver-form';
import { cloudNotifierTypes } from '../../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { cloudReceiverToFormValues } from '../../../utils/receiver-form';
import { useUpsertCloudContactPoint } from '../../contact-points/useContactPoints';

import { CloudCommonChannelSettings } from './CloudCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
import { Notifier } from './notifiers';

interface Props {
  alertManagerSourceName: string;
  config: AlertManagerCortexConfig;
  existing?: Receiver;
  readOnly?: boolean;
}

export const defaultChannelValues: CloudChannelValues = Object.freeze({
  __id: '',
  sendResolved: true,
  secureSettings: {},
  settings: {},
  secureFields: {},
  type: 'email',
});

const cloudNotifiers = cloudNotifierTypes.map<Notifier>((n) => ({ dto: n }));

export const CloudReceiverForm = ({ existing, alertManagerSourceName, config, readOnly = false }: Props) => {
  const history = useHistory();
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
  const [upsert] = useUpsertCloudContactPoint();

  // transform receiver DTO to form values
  const [existingValue] = useMemo((): [ReceiverFormValues<CloudChannelValues> | undefined, CloudChannelMap] => {
    if (!existing) {
      return [undefined, {}];
    }
    return cloudReceiverToFormValues(existing, cloudNotifierTypes);
  }, [existing]);

  const onSubmit = async (values: ReceiverFormValues<CloudChannelValues>) => {
    await upsert(values, existing?.name);
    history.push('/alerting/notifications');
  };

  const takenReceiverNames = useMemo(
    () => config.alertmanager_config.receivers?.map(({ name }) => name).filter((name) => name !== existing?.name) ?? [],
    [config, existing]
  );

  // this basically checks if we can manage the selected alert manager data source, either because it's a Grafana Managed one
  // or a Mimir-based AlertManager
  const isManageableAlertManagerDataSource =
    !readOnly ?? !isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);

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
        notifiers={cloudNotifiers}
        alertManagerSourceName={alertManagerSourceName}
        defaultItem={defaultChannelValues}
        takenReceiverNames={takenReceiverNames}
        commonSettingsComponent={CloudCommonChannelSettings}
      />
    </>
  );
};
