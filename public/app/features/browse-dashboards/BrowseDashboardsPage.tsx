import { css } from '@emotion/css';
import React, { memo, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';
import { Input, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { buildNavModel } from '../folders/state/navModel';
import { parseRouteParams } from '../search/utils';

import { skipToken, useGetFolderQuery } from './api/browseDashboardsAPI';
import { BrowseActions } from './components/BrowseActions';
import { BrowseFilters } from './components/BrowseFilters';
import { BrowseView } from './components/BrowseView';
import { SearchView } from './components/SearchView';
import { useSelectedItemsState } from './state';

export interface BrowseDashboardsPageRouteParams {
  uid?: string;
  slug?: string;
}

interface Props extends GrafanaRouteComponentProps<BrowseDashboardsPageRouteParams> {}

// New Browse/Manage/Search Dashboards views for nested folders

const BrowseDashboardsPage = memo(({ match, location }: Props) => {
  const styles = useStyles2(getStyles);
  const { uid: folderUID } = match.params;

  const searchState = useMemo(() => {
    return parseRouteParams(locationSearchToObject(location.search));
  }, [location.search]);

  const { data: folderDTO } = useGetFolderQuery(folderUID ?? skipToken);
  const navModel = useMemo(() => (folderDTO ? buildNavModel(folderDTO) : undefined), [folderDTO]);

  // TODO abstract this out
  const selectedItems = useSelectedItemsState();
  const hasSelection = Object.values(selectedItems).some((obj) => Object.values(obj).some((v) => v));

  return (
    <Page navId="dashboards/browse" pageNav={navModel}>
      <Page.Contents className={styles.pageContents}>
        <Input placeholder="Search box" />

        {hasSelection ? <BrowseActions /> : <BrowseFilters />}

        <div className={styles.subView}>
          <AutoSizer>
            {({ width, height }) =>
              searchState.query ? (
                <SearchView searchState={searchState} />
              ) : (
                <BrowseView width={width} height={height} folderUID={folderUID} />
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
