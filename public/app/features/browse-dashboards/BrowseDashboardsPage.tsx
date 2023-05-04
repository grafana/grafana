import { css } from '@emotion/css';
import React, { memo, useEffect, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { buildNavModel } from '../folders/state/navModel';
import { useSearchStateManager } from '../search/state/SearchStateManager';
import { getSearchPlaceholder } from '../search/tempI18nPhrases';

import { skipToken, useGetFolderQuery } from './api/browseDashboardsAPI';
import { BrowseActions } from './components/BrowseActions/BrowseActions';
import { BrowseFilters } from './components/BrowseFilters';
import { BrowseView } from './components/BrowseView';
import { CreateNewButton } from './components/CreateNewButton';
import { SearchView } from './components/SearchView';
import { getFolderPermissions } from './permissions';
import { useHasSelection } from './state';

export interface BrowseDashboardsPageRouteParams {
  uid?: string;
  slug?: string;
}

export interface Props extends GrafanaRouteComponentProps<BrowseDashboardsPageRouteParams> {}

// New Browse/Manage/Search Dashboards views for nested folders

const BrowseDashboardsPage = memo(({ match }: Props) => {
  const { uid: folderUID } = match.params;

  const styles = useStyles2(getStyles);
  const [searchState, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();

  useEffect(() => stateManager.initStateFromUrl(folderUID), [folderUID, stateManager]);

  useEffect(() => {
    // Clear the search results when we leave SearchView to prevent old results flashing
    // when starting a new search
    if (!isSearching && searchState.result) {
      stateManager.setState({ result: undefined, includePanels: undefined });
    }
  }, [isSearching, searchState.result, stateManager]);

  const { data: folderDTO } = useGetFolderQuery(folderUID ?? skipToken);
  const navModel = useMemo(() => (folderDTO ? buildNavModel(folderDTO) : undefined), [folderDTO]);
  const hasSelection = useHasSelection();

  const { canEditInFolder, canCreateDashboards, canCreateFolder } = getFolderPermissions(folderDTO);

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      actions={
        (canCreateDashboards || canCreateFolder) && (
          <CreateNewButton
            inFolder={folderUID}
            canCreateDashboard={canCreateDashboards}
            canCreateFolder={canCreateFolder}
          />
        )
      }
    >
      <Page.Contents className={styles.pageContents}>
        <FilterInput
          placeholder={getSearchPlaceholder(searchState.includePanels)}
          value={searchState.query}
          escapeRegex={false}
          onChange={(e) => stateManager.onQueryChange(e)}
        />

        {hasSelection ? <BrowseActions /> : <BrowseFilters />}

        <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }) =>
              isSearching ? (
                <SearchView canSelect={canEditInFolder} width={width} height={height} />
              ) : (
                <BrowseView canSelect={canEditInFolder} width={width} height={height} folderUID={folderUID} />
              )
            }
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

BrowseDashboardsPage.displayName = 'BrowseDashboardsPage';
export default BrowseDashboardsPage;
