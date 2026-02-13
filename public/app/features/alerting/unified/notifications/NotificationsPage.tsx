import { withPageErrorBoundary } from '../withPageErrorBoundary';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';

import { NotificationsScene } from './NotificationsScene';

function NotificationsPage() {
  return (
    <AlertingPageWrapper navId="alerts-notifications" isLoading={false}>
      <NotificationsScene />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationsPage);
