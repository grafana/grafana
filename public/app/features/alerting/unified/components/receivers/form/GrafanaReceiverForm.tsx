import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import {
  useCreateContactPoint,
  useUpdateContactPoint,
} from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { showManageContactPointPermissions } from 'app/features/alerting/unified/components/contact-points/utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import {
  canEditEntity,
  canModifyProtectedEntity,
  isProvisionedResource,
} from 'app/features/alerting/unified/utils/k8s/utils';
import {
  GrafanaManagedContactPoint,
  GrafanaManagedReceiverConfig,
  Receiver,
} from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { GrafanaChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { hasLegacyIntegrations } from '../../../utils/notifier-versions';
import {
  formChannelValuesToGrafanaChannelConfig,
  formValuesToGrafanaReceiver,
  grafanaReceiverToFormValues,
} from '../../../utils/receiver-form';
import { ImportedContactPointAlert, ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
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
  // version is intentionally not set here - it will be determined by the notifier's currentVersion
  // when the integration is created/type is changed. The backend will use its default if not provided.
});

interface Props {
  contactPoint?: GrafanaManagedContactPoint;
  readOnly?: boolean;
  editMode?: boolean;
}

const { useGrafanaNotifiersQuery } = alertmanagerApi;

export const GrafanaReceiverForm = ({ contactPoint, readOnly = false, editMode }: Props) => {
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
  const [testReceivers, setTestReceivers] = useState<Receiver[]>();

  // transform receiver DTO to form values
  const [existingValue, id2original] = useMemo((): [
    ReceiverFormValues<GrafanaChannelValues> | undefined,
    Record<string, GrafanaManagedReceiverConfig>,
  ] => {
    if (!contactPoint || isLoadingNotifiers || isLoadingOnCallIntegration) {
      return [undefined, {}];
    }

    return grafanaReceiverToFormValues(extendOnCallReceivers(contactPoint));
  }, [contactPoint, isLoadingNotifiers, extendOnCallReceivers, isLoadingOnCallIntegration]);

  const onSubmit = async (values: ReceiverFormValues<GrafanaChannelValues>) => {
    const newReceiver = formValuesToGrafanaReceiver(values, id2original, defaultChannelValues);

    try {
      if (editMode) {
        if (contactPoint && contactPoint.id) {
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
    const existing: GrafanaManagedReceiverConfig | undefined = id2original[values.__id];
    const chan = formChannelValuesToGrafanaChannelConfig(values, defaultChannelValues, 'test', existing);

    const receivers: Receiver[] = [
      {
        name: 'test',
        grafana_managed_receiver_configs: [chan],
      },
    ];

    setTestReceivers(receivers);
  };

  // If there is no contact point it means we're creating a new one, so scoped permissions doesn't exist yet
  const hasScopedEditPermissions = contactPoint ? canEditEntity(contactPoint) : true;
  const hasScopedEditProtectedPermissions = contactPoint ? canModifyProtectedEntity(contactPoint) : true;
  const isProvisioned = isProvisionedResource(contactPoint?.provenance);
  const isEditable = !readOnly && hasScopedEditPermissions && !isProvisioned;
  const isTestable = !readOnly;
  const canEditProtectedFields = editMode ? hasScopedEditProtectedPermissions : true;

  if (isLoadingNotifiers || isLoadingOnCallIntegration) {
    return (
      <LoadingPlaceholder text={t('alerting.grafana-receiver-form.text-loading-notifiers', 'Loading notifiers...')} />
    );
  }

  // Map notifiers to Notifier[] format for ReceiverForm
  // The grafanaNotifiers include version-specific options via the versions array from the backend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
  const notifiers: Notifier[] = grafanaNotifiers.map((n) => {
    if (n.type === ReceiverTypes.OnCall) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        dto: extendOnCallNotifierFeatures(n as any) as any,
        meta: onCallNotifierMeta,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    return { dto: n as any };
  });

  return (
    <>
      {hasOnCallError && (
        <Alert
          severity="error"
          title={t(
            'alerting.grafana-receiver-form.title-loading-on-call-integration-failed',
            'Loading OnCall integration failed'
          )}
        >
          <Trans i18nKey="alerting.grafana-receiver-form.body-loading-on-call-integration-failed">
            Grafana OnCall plugin has been enabled in your Grafana instances but it is not reachable. Please check the
            plugin configuration
          </Trans>
        </Alert>
      )}

      {isProvisioned && hasLegacyIntegrations(contactPoint, grafanaNotifiers) && <ImportedContactPointAlert />}
      {isProvisioned && !hasLegacyIntegrations(contactPoint, grafanaNotifiers) && (
        <ProvisioningAlert resource={ProvisionedResource.ContactPoint} />
      )}

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
        canEditProtectedFields={canEditProtectedFields}
      />
      {testReceivers && (
        <TestContactPointModal
          onDismiss={() => setTestReceivers(undefined)}
          isOpen={!!testReceivers}
          alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
          receivers={testReceivers}
        />
      )}
    </>
  );
};
