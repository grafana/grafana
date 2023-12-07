import { css } from '@emotion/css';
import React, { memo, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch } from 'app/types';

import { SearchView } from '../browse-dashboards/components/SearchView';
import { getFolderPermissions } from '../browse-dashboards/permissions';
import { setAllSelection, useHasSelection } from '../browse-dashboards/state';

import { TrashActions } from './components/BrowseActions/TrashActions';
import { BrowseFilters } from './components/BrowseFilters';
import { useTrashStateManager } from './hooks/useTrashStateManager';

export interface Props extends GrafanaRouteComponentProps {}

const TrashDashboardsPage = memo(({ match }: Props) => {
  const dispatch = useDispatch();

  const styles = useStyles2(getStyles);
  const [searchState, stateManager] = useTrashStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const hasSelection = useHasSelection();
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

  useEffect(() => {
    // Clear the search results when we leave SearchView to prevent old results flashing
    // when starting a new search
    if (!isSearching && searchState.result) {
      stateManager.setState({ result: undefined, includePanels: false });
    }
  }, [isSearching, searchState.result, stateManager]);

  return (
    <Page navId="dashboards/trash">
      <Page.Contents className={styles.pageContents}>
        <FilterInput
          placeholder="Search for dashboards"
          value={searchState.query}
          escapeRegex={false}
          onChange={(e) => stateManager.onQueryChange(e)}
        />
        {hasSelection ? <TrashActions /> : <BrowseFilters />}
        <div className={styles.subView}>
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
        </div>
      </Page.Contents>
    </Page>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  pageContents: css({
    display: 'grid',
    gridTemplateRows: 'auto auto 1fr',
    height: '100%',
    rowGap: theme.spacing(1),
  }),

  // AutoSizer needs an element to measure the full height available
  subView: css({
    height: '100%',
  }),
});

TrashDashboardsPage.displayName = 'TrashDashboardsPage';
export default TrashDashboardsPage;
