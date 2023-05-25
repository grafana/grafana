import React from 'react';

import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';

export function BrowseFilters() {
  const [searchState, stateManager] = useSearchStateManager();

  return (
    <div>
      <ActionRow
        hideLayout
        showStarredFilter
        state={searchState}
        getTagOptions={stateManager.getTagOptions}
        getSortOptions={getGrafanaSearcher().getSortOptions}
        sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
        includePanels={searchState.includePanels ?? false}
        onLayoutChange={stateManager.onLayoutChange}
        onStarredFilterChange={stateManager.onStarredFilterChange}
        onSortChange={stateManager.onSortChange}
        onTagFilterChange={stateManager.onTagFilterChange}
        onDatasourceChange={stateManager.onDatasourceChange}
        onPanelTypeChange={stateManager.onPanelTypeChange}
        onSetIncludePanels={stateManager.onSetIncludePanels}
      />
    </div>
  );
}
