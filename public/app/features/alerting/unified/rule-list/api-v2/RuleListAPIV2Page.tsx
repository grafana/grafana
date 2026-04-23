import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useAlertRulesNav } from '../../navigation/useAlertRulesNav';

import { RuleListAPIV2Body } from './RuleListAPIV2Body';

export default function RuleListAPIV2Page() {
  const { navId, pageNav } = useAlertRulesNav();

  // The APIV2 layout owns its own header + rail + recently-deleted affordance, so we strip
  // the tabbed children (Alert rules / Recently deleted) and the subtitle off the shared
  // pageNav before passing it to the wrapper — our body renders its own header.
  const pageNavWithoutTabs = pageNav ? { ...pageNav, children: undefined, subTitle: undefined } : undefined;

  // Suppress the default Grafana page title — the body renders its own PageHeader.
  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNavWithoutTabs} renderTitle={() => null}>
      <RuleListAPIV2Body />
    </AlertingPageWrapper>
  );
}
