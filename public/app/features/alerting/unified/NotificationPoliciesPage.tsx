import { NotificationPoliciesList } from 'app/features/alerting/unified/components/notification-policies/NotificationPoliciesList';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { useNotificationConfigNav } from './navigation/useNotificationConfigNav';
import { useAlertmanager } from './state/AlertmanagerContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const NotificationPoliciesContent = () => {
  const { selectedAlertmanager = '' } = useAlertmanager();
  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
      <NotificationPoliciesList />
    </>
  );
};

function NotificationPoliciesPage() {
  const { navId, pageNav } = useNotificationConfigNav();

  // Show only notification policies (no internal tabs)
  // Time intervals are accessible via the sidebar navigation
  return (
    <AlertmanagerPageWrapper navId={navId || 'am-routes'} pageNav={pageNav} accessType="notification">
      <NotificationPoliciesContent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationPoliciesPage);
