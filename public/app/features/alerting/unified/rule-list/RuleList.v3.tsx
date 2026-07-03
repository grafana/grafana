import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';

export default function RuleListPage() {
  const { navId, pageNav } = useAlertRulesNav();

  return <AlertingPageWrapper navId={navId} pageNav={pageNav} />;
}
