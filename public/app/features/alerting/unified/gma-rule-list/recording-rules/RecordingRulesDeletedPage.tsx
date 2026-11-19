import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useRecordingRulesNav } from '../../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';

import { RecordingRulesDeletedView } from './RecordingRulesDeletedView';

function RecordingRulesDeletedPage() {
  const { navId, pageNav } = useRecordingRulesNav();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <RecordingRulesDeletedView />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(RecordingRulesDeletedPage);
