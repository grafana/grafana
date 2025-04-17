import { useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import {
  useCreateContactPoint,
  useUpdateContactPoint,
} from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { CloudChannelMap, CloudChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
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
  const [createContactPoint] = useCreateContactPoint({ alertmanager: alertManagerSourceName });
  const [updateContactPoint] = useUpdateContactPoint({ alertmanager: alertManagerSourceName });

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
      if (editMode && contactPoint) {
        await updateContactPoint.execute({ contactPoint: newReceiver, originalName: contactPoint.name });
      } else {
        await createContactPoint.execute({ contactPoint: newReceiver });
      }
      locationService.push('/alerting/notifications');
    } catch (error) {
      // React form validation will handle this for us
    }
  };

  // this basically checks if we can manage the selected alert manager data source, either because it's a Grafana Managed one
  // or a Mimir-based AlertManager
  const isManageableAlertManagerDataSource = !readOnly && !isVanillaAM;

  return (
    <>
      {!isVanillaAM && (
        <Alert title={t('alerting.cloud-receiver-form.title-info', 'Info')} severity="info">
          <Trans i18nKey="alerting.cloud-receiver-form.body-info">
            Note that empty string values will be replaced with global defaults where appropriate.
          </Trans>
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
