import React from 'react';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
export function BrowseFilters() {
    var _a;
    const [searchState, stateManager] = useSearchStateManager();
    return (React.createElement("div", null,
        React.createElement(ActionRow, { hideLayout: true, showStarredFilter: true, state: searchState, getTagOptions: stateManager.getTagOptions, getSortOptions: getGrafanaSearcher().getSortOptions, sortPlaceholder: getGrafanaSearcher().sortPlaceholder, includePanels: (_a = searchState.includePanels) !== null && _a !== void 0 ? _a : false, onLayoutChange: stateManager.onLayoutChange, onStarredFilterChange: stateManager.onStarredFilterChange, onSortChange: stateManager.onSortChange, onTagFilterChange: stateManager.onTagFilterChange, onDatasourceChange: stateManager.onDatasourceChange, onPanelTypeChange: stateManager.onPanelTypeChange, onSetIncludePanels: stateManager.onSetIncludePanels })));
}
//# sourceMappingURL=BrowseFilters.js.map