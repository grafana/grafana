import React, { useCallback } from 'react';

import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { StoreState, useSelector, useDispatch } from 'app/types';

import { getDataSourcesSearchQuery, setDataSourcesSearchQuery } from '../state';

export function DataSourcesListHeader() {
  const dispatch = useDispatch();
  const setSearchQuery = useCallback((q: string) => dispatch(setDataSourcesSearchQuery(q)), [dispatch]);
  const searchQuery = useSelector(({ dataSources }: StoreState) => getDataSourcesSearchQuery(dataSources));

  return <PageActionBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} key="action-bar" />;
}
