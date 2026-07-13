import { Stack } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { useAlertRulesNav } from '../navigation/useAlertRulesNav';

import { FilterViewV3 } from './FilterView.v3';
import RulesFilterV3 from './filter/RulesFilter.v3';

export default function RuleListPage() {
  const { navId, pageNav } = useAlertRulesNav();
  const { filterState } = useRulesFilter();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <Stack direction="column" gap={2}>
        <RulesFilterV3 />
        <FilterViewV3 filterState={filterState} />
      </Stack>
    </AlertingPageWrapper>
  );
}
