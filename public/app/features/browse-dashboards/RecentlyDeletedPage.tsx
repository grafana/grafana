import { memo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { EmptyState } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';

import { useDispatch } from '../../types';

import { useRecentlyDeletedStateManager } from './api/useRecentlyDeletedStateManager';
import { RecentlyDeletedActions } from './components/RecentlyDeletedActions';
import { SearchView } from './components/SearchView';
import { getFolderPermissions } from './permissions';
import { setAllSelection } from './state';

const RecentlyDeletedPage = memo(() => {
  const dispatch = useDispatch();

  const [searchState, stateManager] = useRecentlyDeletedStateManager();

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

  if (
    searchState.loading === false &&
    searchState.query.length === 0 &&
    searchState.tag.length === 0 &&
    searchState.result?.totalRows === 0
  ) {
    return (
      <Page navId="dashboards/recently-deleted">
        <Page.Contents>
          <EmptyState
            variant="completed"
            message={t('recently-deleted.page.empty-state', "You haven't deleted any dashboards recently.")}
          />
        </Page.Contents>
      </Page>
    );
  }

  return (
    <Page navId="dashboards/recently-deleted">
      <Page.Contents>
        {searchState.result && (
          <>
            <ActionRow
              state={searchState}
              getTagOptions={stateManager.getTagOptions}
              getSortOptions={getGrafanaSearcher().getSortOptions}
              sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
              onLayoutChange={stateManager.onLayoutChange}
              onSortChange={stateManager.onSortChange}
              onTagFilterChange={stateManager.onTagFilterChange}
              onDatasourceChange={stateManager.onDatasourceChange}
              onPanelTypeChange={stateManager.onPanelTypeChange}
              onSetIncludePanels={stateManager.onSetIncludePanels}
            />
            <RecentlyDeletedActions />
            <AutoSizer>
              {({ width, height }) => (
                <SearchView
                  canSelect={canSelect}
                  width={width}
                  height={height}
                  searchStateManager={stateManager}
                  searchState={searchState}
                />
              )}
            </AutoSizer>
          </>
        )}
      </Page.Contents>
    </Page>
  );
});

RecentlyDeletedPage.displayName = 'RecentlyDeletedPage';
export default RecentlyDeletedPage;
