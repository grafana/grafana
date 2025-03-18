import { useMemo, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import {
  useCreateContactPoint,
  useUpdateContactPoint,
} from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { showManageContactPointPermissions } from 'app/features/alerting/unified/components/contact-points/utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { canEditEntity } from 'app/features/alerting/unified/utils/k8s/utils';
import {
  GrafanaManagedContactPoint,
  GrafanaManagedReceiverConfig,
  TestReceiversAlert,
} from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { testReceiversAction } from '../../../state/actions';
import { GrafanaChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { shouldUseK8sApi } from '../../../utils/k8s/utils';
import {
  formChannelValuesToGrafanaChannelConfig,
  formValuesToGrafanaReceiver,
  grafanaReceiverToFormValues,
} from '../../../utils/receiver-form';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { ReceiverTypes } from '../grafanaAppReceivers/onCall/onCall';
import { useOnCallIntegration } from '../grafanaAppReceivers/onCall/useOnCallIntegration';

import { GrafanaCommonChannelSettings } from './GrafanaCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
import { TestContactPointModal } from './TestContactPointModal';
import { Notifier } from './notifiers';

const defaultChannelValues: GrafanaChannelValues = Object.freeze({
  __id: '',
  secureSettings: {},
  settings: {},
  secureFields: {},
  disableResolveMessage: false,
  type: 'email',
});

interface Props {
  contactPoint?: GrafanaManagedContactPoint;
  readOnly?: boolean;
  editMode?: boolean;
}

const { useGrafanaNotifiersQuery } = alertmanagerApi;

export const GrafanaReceiverForm = ({ contactPoint, readOnly = false, editMode }: Props) => {
  const dispatch = useDispatch();
  const useK8sAPI = shouldUseK8sApi(GRAFANA_RULES_SOURCE_NAME);
  const [createContactPoint] = useCreateContactPoint({
    alertmanager: GRAFANA_RULES_SOURCE_NAME,
  });
  const [updateContactPoint] = useUpdateContactPoint({
    alertmanager: GRAFANA_RULES_SOURCE_NAME,
  });

  const {
    onCallNotifierMeta,
    extendOnCallNotifierFeatures,
    extendOnCallReceivers,
    onCallFormValidators,
    isLoadingOnCallIntegration,
    hasOnCallError,
  } = useOnCallIntegration();

  const { data: grafanaNotifiers = [], isLoading: isLoadingNotifiers } = useGrafanaNotifiersQuery();

  const [testChannelValues, setTestChannelValues] = useState<GrafanaChannelValues>();

  // transform receiver DTO to form values
  const [existingValue, id2original] = useMemo((): [
    ReceiverFormValues<GrafanaChannelValues> | undefined,
    Record<string, GrafanaManagedReceiverConfig>,
  ] => {
    if (!contactPoint || isLoadingNotifiers || isLoadingOnCallIntegration) {
      return [undefined, {}];
    }

    return grafanaReceiverToFormValues(extendOnCallReceivers(contactPoint), grafanaNotifiers);
  }, [contactPoint, isLoadingNotifiers, grafanaNotifiers, extendOnCallReceivers, isLoadingOnCallIntegration]);

  const onSubmit = async (values: ReceiverFormValues<GrafanaChannelValues>) => {
    const newReceiver = formValuesToGrafanaReceiver(values, id2original, defaultChannelValues, grafanaNotifiers);

    try {
      if (editMode) {
        if (useK8sAPI && contactPoint && contactPoint.id) {
          await updateContactPoint.execute({
            contactPoint: newReceiver,
            id: contactPoint.id,
            resourceVersion: contactPoint?.metadata?.resourceVersion,
          });
        } else if (contactPoint) {
          await updateContactPoint.execute({
            contactPoint: newReceiver,
            originalName: contactPoint.name,
          });
        }
      } else {
        await createContactPoint.execute({ contactPoint: newReceiver });
      }
      locationService.push('/alerting/notifications');
    } catch (error) {
      // React form validation will handle this for us
    }
  };

  const onTestChannel = (values: GrafanaChannelValues) => {
    setTestChannelValues(values);
  };

  const testNotification = (alert?: TestReceiversAlert) => {
    if (testChannelValues) {
      const existing: GrafanaManagedReceiverConfig | undefined = id2original[testChannelValues.__id];
      const chan = formChannelValuesToGrafanaChannelConfig(testChannelValues, defaultChannelValues, 'test', existing);

      const payload = {
        alertManagerSourceName: GRAFANA_RULES_SOURCE_NAME,
        receivers: [
          {
            name: 'test',
            grafana_managed_receiver_configs: [chan],
          },
        ],
        alert,
      };

      dispatch(testReceiversAction(payload));
    }
  };

  const isEditable = Boolean(
    (!readOnly || (contactPoint && canEditEntity(contactPoint))) && !contactPoint?.provisioned
  );
  const isTestable = !readOnly;

  if (isLoadingNotifiers || isLoadingOnCallIntegration) {
    return <LoadingPlaceholder text="Loading notifiers..." />;
  }

  const notifiers: Notifier[] = grafanaNotifiers.map((n) => {
    if (n.type === ReceiverTypes.OnCall) {
      return {
        dto: extendOnCallNotifierFeatures(n),
        meta: onCallNotifierMeta,
      };
    }

    return { dto: n };
  });
  return (
    <>
      {hasOnCallError && (
        <Alert severity="error" title="Loading OnCall integration failed">
          Grafana OnCall plugin has been enabled in your Grafana instances but it is not reachable. Please check the
          plugin configuration
        </Alert>
      )}

      {contactPoint?.provisioned && <ProvisioningAlert resource={ProvisionedResource.ContactPoint} />}

      <ReceiverForm<GrafanaChannelValues>
        contactPointId={contactPoint?.id}
        isEditable={isEditable}
        isTestable={isTestable}
        onSubmit={onSubmit}
        initialValues={existingValue}
        onTestChannel={onTestChannel}
        notifiers={notifiers}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        defaultItem={{ ...defaultChannelValues }}
        commonSettingsComponent={GrafanaCommonChannelSettings}
        customValidators={{ [ReceiverTypes.OnCall]: onCallFormValidators }}
        canManagePermissions={
          editMode && contactPoint && showManageContactPointPermissions(GRAFANA_RULES_SOURCE_NAME, contactPoint)
        }
      />
      <TestContactPointModal
        onDismiss={() => setTestChannelValues(undefined)}
        isOpen={!!testChannelValues}
        onTest={(alert) => testNotification(alert)}
      />
    </>
  );
};
