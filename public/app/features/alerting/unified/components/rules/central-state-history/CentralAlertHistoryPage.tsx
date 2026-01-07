import { useInsightsNav } from '../../../navigation/useInsightsNav';
import { withPageErrorBoundary } from '../../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../../AlertingPageWrapper';

import { CentralAlertHistoryScene } from './CentralAlertHistoryScene';

function HistoryPage() {
  const { navId, pageNav } = useInsightsNav();
  return (
    <AlertingPageWrapper navId={navId || 'alerts-history'} pageNav={pageNav} isLoading={false}>
      <CentralAlertHistoryScene />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(HistoryPage);
