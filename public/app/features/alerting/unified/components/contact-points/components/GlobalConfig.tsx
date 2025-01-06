import { Alert, withErrorBoundary } from '@grafana/ui';

import { useAlertmanagerConfig } from '../../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { AlertmanagerPageWrapper } from '../../AlertingPageWrapper';
import { GlobalConfigForm } from '../../receivers/GlobalConfigForm';

const NewMessageTemplate = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  if (isLoading && !data) {
    return 'loading...';
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch notification template">
        {String(error)}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return <GlobalConfigForm config={data} alertManagerSourceName={selectedAlertmanager!} />;
};

function NewMessageTemplatePage() {
  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <NewMessageTemplate />
    </AlertmanagerPageWrapper>
  );
}

export default withErrorBoundary(NewMessageTemplatePage, { style: 'page' });
