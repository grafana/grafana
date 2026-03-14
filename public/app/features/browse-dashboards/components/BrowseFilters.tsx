import { config } from '@grafana/runtime';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';

export function BrowseFilters() {
  const [searchState, stateManager] = useSearchStateManager();

  const showTeamFoldersFilter =
    !!config.featureToggles.unifiedStorageSearchUI &&
    !!config.featureToggles.teamFolders &&
    !!config.featureToggles.foldersAppPlatformAPI;

  return (
    <ActionRow
      showStarredFilter
      showTeamFoldersFilter={showTeamFoldersFilter}
      showLayout
      state={searchState}
      getTagOptions={stateManager.getTagOptions}
      getSortOptions={getGrafanaSearcher().getSortOptions}
      sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
      onLayoutChange={stateManager.onLayoutChange}
      onStarredFilterChange={stateManager.onStarredFilterChange}
      onTeamFoldersFilterChange={stateManager.onTeamFoldersFilterChange}
      onSortChange={stateManager.onSortChange}
      onTagFilterChange={stateManager.onTagFilterChange}
      onDatasourceChange={stateManager.onDatasourceChange}
      onPanelTypeChange={stateManager.onPanelTypeChange}
      onSetIncludePanels={stateManager.onSetIncludePanels}
      onCreatedByChange={stateManager.onCreatedByChange}
    />
  );
}
