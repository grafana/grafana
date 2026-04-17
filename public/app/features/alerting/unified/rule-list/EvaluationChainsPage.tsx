import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../withPageErrorBoundary';

import { EvaluationChainsTab } from './tabs/EvaluationChainsTab';

function EvaluationChainsPage() {
  const { navId, pageNav } = useAlertRulesNav();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <EvaluationChainsTab />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(EvaluationChainsPage);
