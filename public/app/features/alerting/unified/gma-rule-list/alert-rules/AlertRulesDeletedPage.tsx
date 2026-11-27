import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';

import { AlertRulesDeletedView } from './AlertRulesDeletedView';

function AlertRulesDeletedPage() {
  const { navId, pageNav } = useAlertRulesNav();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <AlertRulesDeletedView />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(AlertRulesDeletedPage);
