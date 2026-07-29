import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';

import { FilterViewV3 } from './FilterView.v3';

export default function RuleListPage() {
  const { navId, pageNav } = useAlertRulesNav();
  const { filterState } = useRulesFilter();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <FilterViewV3 filterState={filterState} />
    </AlertingPageWrapper>
  );
}
