import { useParams } from 'react-router-dom-v5-compat';

import { Alert, LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';
import { useGetContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { useAlertmanager } from '../../state/AlertmanagerContext';
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
    return <LoadingPlaceholder text="Loading..." />;
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch contact point">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!contactPoint) {
    return (
      <Alert severity="error" title="Receiver not found">
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

export default withErrorBoundary(EditContactPointPage, { style: 'page' });
