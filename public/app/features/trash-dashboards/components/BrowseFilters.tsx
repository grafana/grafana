import React from 'react';

import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';

import { useTrashStateManager } from '../hooks/useTrashStateManager';

export function BrowseFilters() {
  const [searchState, stateManager] = useTrashStateManager();

  return (
    <div>
      <ActionRow
        showStarredFilter={false}
        state={searchState}
        getTagOptions={stateManager.getTagOptions}
        getSortOptions={getGrafanaSearcher().getSortOptions}
        sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
        includePanels={false}
        onLayoutChange={stateManager.onLayoutChange}
        onSortChange={stateManager.onSortChange}
        onTagFilterChange={stateManager.onTagFilterChange}
        onDatasourceChange={stateManager.onDatasourceChange}
        onPanelTypeChange={stateManager.onPanelTypeChange}
        onSetIncludePanels={stateManager.onSetIncludePanels}
      />
    </div>
  );
}
