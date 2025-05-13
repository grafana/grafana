import { useParams } from 'react-router-dom-v5-compat';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useGetContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { EditReceiverView } from '../receivers/EditReceiverView';

const EditContactPoint = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { name = '' } = useParams();

  const contactPointName = decodeURIComponent(name);
  const {
    isLoading,
    error,
    data: contactPoint,
  } = useGetContactPoint({ name: contactPointName, alertmanager: selectedAlertmanager! });

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
        {'Sorry, this contact point does not seem to exist.'}
      </Alert>
    );
  }

  return <EditReceiverView alertmanagerName={selectedAlertmanager!} contactPoint={contactPoint} />;
};

function EditContactPointPage() {
  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <EditContactPoint />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(EditContactPointPage);
