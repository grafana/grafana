import { withErrorBoundary } from '@grafana/ui';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';

import { CloudReceiverForm } from './form/CloudReceiverForm';
import { GrafanaReceiverForm } from './form/GrafanaReceiverForm';

const NewReceiverView = () => {
  const { selectedAlertmanager } = useAlertmanager();
  if (selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME) {
    return <GrafanaReceiverForm />;
  } else {
    return <CloudReceiverForm alertManagerSourceName={selectedAlertmanager!} />;
  }
};

function NewReceiverViewPage() {
  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <NewReceiverView />
    </AlertmanagerPageWrapper>
  );
}

export default withErrorBoundary(NewReceiverViewPage, { style: 'page' });
