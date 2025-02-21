import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import RulesFilter from '../components/rules/Filter/RulesFilter';
import { SupportedView } from '../components/rules/Filter/RulesViewModeSelector';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { useURLSearchParams } from '../hooks/useURLSearchParams';

import { FilterView } from './FilterView';
import { GroupedView } from './GroupedView';

function RuleList() {
  const [queryParams] = useURLSearchParams();
  const { filterState, hasActiveFilters } = useRulesFilter();

  const view: SupportedView = queryParams.get('view') === 'list' ? 'list' : 'grouped';
  const showListView = hasActiveFilters || view === 'list';

  return (
    <>
      <RulesFilter onClear={() => {}} />
      {showListView ? <FilterView filterState={filterState} /> : <GroupedView />}
    </>
  );
}

export default function RuleListPage() {
  return (
    <AlertingPageWrapper navId="alert-list" isLoading={false} actions={null}>
      <RuleList />
    </AlertingPageWrapper>
  );
}
