import React, { memo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { FilterInput } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';

import { useDispatch } from '../../types';
import { Props as DashboardRouteComponentsProps } from '../browse-dashboards/BrowseDashboardsPage';
import { BrowseView } from '../browse-dashboards/components/BrowseView';
import { SearchView } from '../browse-dashboards/components/SearchView';
import { getFolderPermissions } from '../browse-dashboards/permissions';
import { setAllSelection } from '../browse-dashboards/state';

import { useTrashStateManager } from './utils/useTrashStateManager';

const TrashPage = memo(({ match }: DashboardRouteComponentsProps) => {
  const { uid: folderUID } = match.params;
  const dispatch = useDispatch();

  const [searchState, stateManager] = useTrashStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const { canEditFolders, canEditDashboards } = getFolderPermissions();
  const canSelect = canEditFolders || canEditDashboards;

  useEffect(() => {
    stateManager.initStateFromUrl(undefined);

    // Clear selected state when folderUID changes
    dispatch(
      setAllSelection({
        isSelected: false,
        folderUID: undefined,
      })
    );
  }, [dispatch, stateManager]);

  return (
    <Page navId="dashboards/trash">
      <Page.Contents>
        <FilterInput
          placeholder={t('trashSection.filter.placeholder', 'Search for dashboards')}
          value={searchState.query}
          escapeRegex={false}
          onChange={(e) => stateManager.onQueryChange(e)}
        />
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
        <AutoSizer>
          {({ width, height }) =>
            isSearching ? (
              <SearchView
                canSelect={canSelect}
                width={width}
                height={height}
                searchStateManager={stateManager}
                searchState={searchState}
              />
            ) : (
              <BrowseView canSelect={canSelect} width={width} height={height} folderUID={folderUID} />
            )
          }
        </AutoSizer>
      </Page.Contents>
    </Page>
  );
});

TrashPage.displayName = 'TrashPage';
export default TrashPage;
