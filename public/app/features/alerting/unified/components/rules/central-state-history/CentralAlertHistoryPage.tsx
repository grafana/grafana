import { withPageErrorBoundary } from '../../../withPageErrorBoundary';
import { AlertingPageWrapper } from '../../AlertingPageWrapper';

import { CentralAlertHistoryScene } from './CentralAlertHistoryScene';

function HistoryPage() {
  return (
    <AlertingPageWrapper navId="alerts-history" isLoading={false}>
      <CentralAlertHistoryScene />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(HistoryPage);
