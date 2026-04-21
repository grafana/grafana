import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useGetContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { EditReceiverView } from 'app/features/alerting/unified/components/receivers/EditReceiverView';
import { AlertmanagerProvider, useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

export interface EditContactPointDrawerProps {
  /** Receiver identifier for the GET API (K8s `metadata.name` when using the Grafana notifications API, not only `spec.title`). */
  contactPointName: string;
  /** Called after a successful save (e.g. pop edit drawer). */
  onSaveSuccess: () => void;
}

/**
 * Contact point edit form for use inside a stacked drawer (e.g. from Alert Activity instance flow).
 * Omits the in-form manage-permissions control; permissions remain available from the contact point view drawer.
 */
export function EditContactPointDrawer({ contactPointName, onSaveSuccess }: EditContactPointDrawerProps) {
  return (
    <AlertmanagerProvider accessType="instance">
      <EditContactPointDrawerBody contactPointName={contactPointName} onSaveSuccess={onSaveSuccess} />
    </AlertmanagerProvider>
  );
}

function EditContactPointDrawerBody({ contactPointName, onSaveSuccess }: EditContactPointDrawerProps) {
  const { selectedAlertmanager } = useAlertmanager();

  const {
    isLoading,
    error,
    data: contactPoint,
  } = useGetContactPoint({
    name: contactPointName,
    alertmanager: selectedAlertmanager ?? '',
    skip: !selectedAlertmanager,
  });

  if (!selectedAlertmanager) {
    return (
      <Alert
        severity="warning"
        title={t('alerting.triage.contact-point-drawer.no-alertmanager-title', 'No alert manager')}
      >
        {t(
          'alerting.triage.contact-point-drawer.no-alertmanager-description',
          'No alert manager is available for this session.'
        )}
      </Alert>
    );
  }

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.edit-contact-point.text-loading', 'Loading...')} />;
  }

  if (error) {
    return (
      <Alert
        severity="error"
        title={t('alerting.edit-contact-point.title-failed-to-fetch-contact-point', 'Failed to fetch contact point')}
      >
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!contactPoint) {
    return (
      <Alert severity="error" title={t('alerting.edit-contact-point.title-receiver-not-found', 'Receiver not found')}>
        {t('alerting.edit-contact-point.receiver-not-found-body', 'Sorry, this contact point does not seem to exist.')}
      </Alert>
    );
  }

  return (
    <EditReceiverView
      alertmanagerName={selectedAlertmanager}
      contactPoint={contactPoint}
      onSaveSuccess={onSaveSuccess}
      hidePermissionsAction
    />
  );
}
