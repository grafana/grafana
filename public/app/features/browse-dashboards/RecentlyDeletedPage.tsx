import { css } from '@emotion/css';
import { memo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { ActionRow } from 'app/features/search/page/components/ActionRow';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { useDispatch } from 'app/types/store';

import { useRecentlyDeletedStateManager } from './api/useRecentlyDeletedStateManager';
import { RecentlyDeletedActions } from './components/RecentlyDeletedActions';
import { RecentlyDeletedEmptyState } from './components/RecentlyDeletedEmptyState';
import { SearchView } from './components/SearchView';
import { getFolderPermissions } from './permissions';
import { useHasSelection } from './state/hooks';
import { setAllSelection } from './state/slice';

const RecentlyDeletedPage = memo(() => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const [searchState, stateManager] = useRecentlyDeletedStateManager();
  const hasSelection = useHasSelection();

  const { canEditFolders, canEditDashboards, canDeleteFolders, canDeleteDashboards } = getFolderPermissions();
  const permissions = { canEditFolders, canEditDashboards, canDeleteFolders, canDeleteDashboards };

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
    <Page navId="dashboards/recently-deleted">
      <Page.Contents className={styles.pageContents}>
        <div>
          <FilterInput
            placeholder={t('recentlyDeleted.filter.placeholder', 'Search for dashboards')}
            value={searchState.query}
            escapeRegex={false}
            onChange={stateManager.onQueryChange}
          />
        </div>

        {hasSelection ? (
          <RecentlyDeletedActions />
        ) : (
          <div className={styles.filters}>
            <ActionRow
              state={searchState}
              getTagOptions={stateManager.getTagOptions}
              getSortOptions={stateManager.getSortOptions}
              sortPlaceholder={getGrafanaSearcher().sortPlaceholder}
              onLayoutChange={stateManager.onLayoutChange}
              onSortChange={stateManager.onSortChange}
              onTagFilterChange={stateManager.onTagFilterChange}
              onDatasourceChange={stateManager.onDatasourceChange}
              onPanelTypeChange={stateManager.onPanelTypeChange}
              onSetIncludePanels={stateManager.onSetIncludePanels}
            />
          </div>
        )}

        <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }) => (
              <SearchView
                permissions={permissions}
                width={width}
                height={height}
                searchStateManager={stateManager}
                searchState={searchState}
                emptyState={<RecentlyDeletedEmptyState searchState={searchState} />}
              />
            )}
          </AutoSizer>
        </div>
      </Page.Contents>
    </Page>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    height: '100%',
  }),

  // AutoSizer needs an element to measure the full height available
  subView: css({
    height: '100%',
  }),

  filters: css({
    display: 'none',

    [theme.breakpoints.up('md')]: {
      display: 'block',
    },
  }),
});

RecentlyDeletedPage.displayName = 'RecentlyDeletedPage';
export default RecentlyDeletedPage;
