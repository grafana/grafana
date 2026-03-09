import { useAlertHistoryNav } from '../../../navigation/useInsightsNav';
import { withPageErrorBoundary } from '../../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../../AlertingPageWrapper';

import { CentralAlertHistoryScene } from './CentralAlertHistoryScene';

function HistoryPage() {
  const { navId, pageNav } = useAlertHistoryNav();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav} isLoading={false}>
      <CentralAlertHistoryScene />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(HistoryPage);
