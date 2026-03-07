import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useNotificationHistoryNav } from '../navigation/useInsightsNav';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { NotificationsScene } from './NotificationsScene';

function NotificationsPage() {
  const { navId, pageNav } = useNotificationHistoryNav();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav} isLoading={false}>
      <NotificationsScene />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationsPage);
