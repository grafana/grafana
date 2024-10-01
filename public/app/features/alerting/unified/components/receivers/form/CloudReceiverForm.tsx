import { useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import {
  useCreateContactPoint,
  useUpdateContactPoint,
} from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { CloudChannelValues, ReceiverFormValues, CloudChannelMap } from '../../../types/receiver-form';
import { cloudNotifierTypes } from '../../../utils/cloud-alertmanager-notifier-types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { cloudReceiverToFormValues, formValuesToCloudReceiver } from '../../../utils/receiver-form';

import { CloudCommonChannelSettings } from './CloudCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
import { Notifier } from './notifiers';

interface Props {
  alertManagerSourceName: string;
  contactPoint?: Receiver;
  readOnly?: boolean;
  editMode?: boolean;
}

const defaultChannelValues: CloudChannelValues = Object.freeze({
  __id: '',
  sendResolved: true,
  secureSettings: {},
  settings: {},
  secureFields: {},
  type: 'email',
});

const cloudNotifiers = cloudNotifierTypes.map<Notifier>((n) => ({ dto: n }));
const { useGetAlertmanagerConfigurationQuery } = alertmanagerApi;

export const CloudReceiverForm = ({ contactPoint, alertManagerSourceName, readOnly = false, editMode }: Props) => {
  const { isLoading, data: config } = useGetAlertmanagerConfigurationQuery(alertManagerSourceName);

  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName);
  const createContactPoint = useCreateContactPoint({ alertmanager: alertManagerSourceName });
  const updateContactPoint = useUpdateContactPoint({ alertmanager: alertManagerSourceName });

  // transform receiver DTO to form values
  const [existingValue] = useMemo((): [ReceiverFormValues<CloudChannelValues> | undefined, CloudChannelMap] => {
    if (!contactPoint) {
      return [undefined, {}];
    }
    return cloudReceiverToFormValues(contactPoint, cloudNotifierTypes);
  }, [contactPoint]);

  const onSubmit = async (values: ReceiverFormValues<CloudChannelValues>) => {
    const newReceiver = formValuesToCloudReceiver(values, defaultChannelValues);
    try {
      if (editMode) {
        await updateContactPoint({ contactPoint: newReceiver, originalName: contactPoint!.name });
      } else {
        await createContactPoint({ contactPoint: newReceiver });
      }
      locationService.push('/alerting/notifications');
    } catch (error) {
      // React form validation will handle this for us
    }
  };

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
        showDefaultRouteWarning={!isLoading && !config?.alertmanager_config.route}
        isEditable={isManageableAlertManagerDataSource}
        isTestable={isManageableAlertManagerDataSource}
        onSubmit={onSubmit}
        initialValues={existingValue}
        notifiers={cloudNotifiers}
        alertManagerSourceName={alertManagerSourceName}
        defaultItem={defaultChannelValues}
        commonSettingsComponent={CloudCommonChannelSettings}
      />
    </>
  );
};
