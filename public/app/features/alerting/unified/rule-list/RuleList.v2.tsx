import { withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import RulesFilter from '../components/rules/Filter/RulesFilter';
import { SupportedView } from '../components/rules/Filter/RulesViewModeSelector';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { useURLSearchParams } from '../hooks/useURLSearchParams';

import { FilterView } from './FilterView';
import { GroupedView } from './GroupedView';

const RuleList = withErrorBoundary(
  () => {
    const [queryParams] = useURLSearchParams();
    const { filterState, hasActiveFilters } = useRulesFilter();

    const view: SupportedView = queryParams.get('view') === 'list' ? 'list' : 'grouped';
    const showListView = hasActiveFilters || view === 'list';

    return (
      // We don't want to show the Loading... indicator for the whole page.
      // We show separate indicators for Grafana-managed and Cloud rules
      <AlertingPageWrapper navId="alert-list" isLoading={false} actions={null}>
        <RulesFilter onClear={() => {}} />
        {showListView ? <FilterView filterState={filterState} /> : <GroupedView />}
      </AlertingPageWrapper>
    );
  },
  { style: 'page' }
);

export default RuleList;
