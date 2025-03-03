import { Alert } from '@grafana/ui';

import { useAlertmanagerConfig } from '../../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { withPageErrorBoundary } from '../../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../../AlertingPageWrapper';
import { GlobalConfigForm } from '../../receivers/GlobalConfigForm';

const GlobalConfig = () => {
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

function GlobalConfigPage() {
  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <GlobalConfig />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(GlobalConfigPage);
