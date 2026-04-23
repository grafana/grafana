import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../../navigation/useAlertRulesNav';

import { RuleListAPIV2Body } from './RuleListAPIV2Body';

export default function RuleListAPIV2Page() {
  const { navId, pageNav } = useAlertRulesNav();

  // The APIV2 layout owns its own header + rail + recently-deleted affordance, so we strip
  // the tabbed children (Alert rules / Recently deleted) off the shared pageNav before
  // passing it to the wrapper.
  const pageNavWithoutTabs = pageNav ? { ...pageNav, children: undefined } : undefined;

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNavWithoutTabs}>
      <RuleListAPIV2Body />
    </AlertingPageWrapper>
  );
}
