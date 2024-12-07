import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { RadioButtonGroup } from '@grafana/ui';

import { trackRulesListViewChange } from '../../../Analytics';
import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { useURLSearchParams } from '../../../hooks/useURLSearchParams';

export type SupportedView = 'list' | 'grouped';

type LegacySupportedView = 'list' | 'grouped' | 'state';

const ViewOptions: Array<SelectableValue<SupportedView>> = [
  { icon: 'folder', label: 'Grouped', value: 'grouped' },
  { icon: 'list-ul', label: 'List', value: 'list' },
];

function RulesViewModeSelectorV2() {
  const [queryParams, updateQueryParams] = useURLSearchParams();
  const { hasActiveFilters } = useRulesFilter();
  const wantsListView = queryParams.get('view') === 'list';

  const selectedViewOption = hasActiveFilters || wantsListView ? 'list' : 'grouped';

  /* If we change to the grouped view, we just remove the "list" and "search" params */
  const handleViewChange = (view: SupportedView) => {
    if (view === 'list') {
      updateQueryParams({ view });
      trackRulesListViewChange({ view });
    } else {
      updateQueryParams({ view: undefined, search: undefined });
    }
  };

  return <RadioButtonGroup options={ViewOptions} value={selectedViewOption} onChange={handleViewChange} />;
}

const LegacyViewOptions: Array<SelectableValue<LegacySupportedView>> = [
  { label: 'Grouped', value: 'grouped' },
  { label: 'List', value: 'list' },
  { label: 'State', value: 'state' },
];

function RulesViewModeSelectorV1() {
  const [queryParams, updateQueryParams] = useURLSearchParams();

  const viewParam = queryParams.get('view');

  // Returning the same values for list and state are for type safety
  const currentView: LegacySupportedView = viewParam === 'list' ? 'list' : viewParam === 'state' ? 'state' : 'grouped';

  const handleViewChange = (view: LegacySupportedView) => {
    updateQueryParams({ view });
  };

  return <RadioButtonGroup options={LegacyViewOptions} value={currentView} onChange={handleViewChange} />;
}

export const RulesViewModeSelector = config.featureToggles.alertingListViewV2
  ? RulesViewModeSelectorV2
  : RulesViewModeSelectorV1;
