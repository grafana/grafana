import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';

import { useContactPointsNav } from '../../navigation/useNotificationConfigNav';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
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
  const { navId, pageNav } = useContactPointsNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <NewReceiverView />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NewReceiverViewPage);
