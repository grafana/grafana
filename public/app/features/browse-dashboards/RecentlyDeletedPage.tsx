import { memo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { FilterInput, Stack, EmptyState } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service';
import { SearchState } from 'app/features/search/types';

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

  // if (
  //   searchState.loading === false &&
  //   searchState.query.length === 0 &&
  //   searchState.tag.length === 0 &&
  //   searchState.result?.totalRows === 0
  // ) {
  //   return (
  //     <Page navId="dashboards/recently-deleted">
  //       <Page.Contents>
  //         <EmptyState
  //           variant="completed"
  //           message={t('recently-deleted.page.empty-state', "You haven't deleted any dashboards recently.")}
  //         />
  //       </Page.Contents>
  //     </Page>
  //   );
  // }

  return (
    <Page navId="dashboards/recently-deleted">
      <Page.Contents>
        {searchState.result && (
          <>
            <Stack direction="column">
              <FilterInput
                placeholder={t('recentlyDeleted.filter.placeholder', 'Search for dashboards')}
                value={searchState.query}
                escapeRegex={false}
                onChange={stateManager.onQueryChange}
              />
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
            </Stack>
            <RecentlyDeletedActions />
            <AutoSizer>
              {({ width, height }) => (
                <SearchView
                  canSelect={canSelect}
                  width={width}
                  height={height}
                  searchStateManager={stateManager}
                  searchState={searchState}
                  emptyState={<RecentlyDeletedEmptyState searchState={searchState} />}
                />
              )}
            </AutoSizer>
          </>
        )}
      </Page.Contents>
    </Page>
  );
});

interface RecentlyDeletedEmptyStateProps {
  searchState: SearchState;
}

const RecentlyDeletedEmptyState = ({ searchState }: RecentlyDeletedEmptyStateProps) => {
  const userIsSearching = Boolean(searchState.query || searchState.tag.length);
  return (
    <EmptyState
      message={userIsSearching ? 'no search result' : 'You have not deleted any dashboards recently.'}
      variant="not-found"
      role="alert"
    />
  );
};

RecentlyDeletedPage.displayName = 'RecentlyDeletedPage';
export default RecentlyDeletedPage;
