import React, { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { contextSrv } from 'app/core/core';
import { StoreState, useSelector, useDispatch, AccessControlAction } from 'app/types';

import {
  getDataSourcesSearchQuery,
  getDataSourcesSort,
  setDataSourcesSearchQuery,
  setIsSortAscending,
  useDataSourcesRoutes,
} from '../state';

const ascendingSortValue = 'alpha-asc';
const descendingSortValue = 'alpha-desc';

const sortOptions = [
  // We use this unicode 'en dash' character (U+2013), because it looks nicer
  // than simple dash in this context. This is also used in the response of
  // the `sorting` endpoint, which is used in the search dashboard page.
  { label: 'Sort by A–Z', value: ascendingSortValue },
  { label: 'Sort by Z–A', value: descendingSortValue },
];

export function DataSourcesListHeader() {
  const dispatch = useDispatch();
  const setSearchQuery = useCallback((q: string) => dispatch(setDataSourcesSearchQuery(q)), [dispatch]);
  const searchQuery = useSelector(({ dataSources }: StoreState) => getDataSourcesSearchQuery(dataSources));

  // TODO remove this logic adding the link button once topnav is live
  // instead use the actions in DataSourcesListPage
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const dataSourcesRoutes = useDataSourcesRoutes();
  const isTopnav = config.featureToggles.topnav;
  const linkButton =
    !isTopnav && canCreateDataSource
      ? {
          href: dataSourcesRoutes.New,
          title: 'Add new data source',
        }
      : undefined;

  const setSort = useCallback(
    (sort: SelectableValue) => dispatch(setIsSortAscending(sort.value === ascendingSortValue)),
    [dispatch]
  );
  const isSortAscending = useSelector(({ dataSources }: StoreState) => getDataSourcesSort(dataSources));

  const sortPicker = {
    onChange: setSort,
    value: isSortAscending ? ascendingSortValue : descendingSortValue,
    getSortOptions: () => Promise.resolve(sortOptions),
  };

  return (
    <PageActionBar
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      key="action-bar"
      sortPicker={sortPicker}
      linkButton={linkButton}
    />
  );
}
