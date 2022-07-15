import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, StoreState } from 'app/types';

import { setDataSourcesSearchQuery } from './state/reducers';
import { getDataSourcesSearchQuery } from './state/selectors';

export const DataSourcesListHeader = () => {
  const dispatch = useDispatch();
  const setSearchQuery = useCallback((q: string) => dispatch(setDataSourcesSearchQuery(q)), [dispatch]);
  const searchQuery = useSelector(({ dataSources }: StoreState) => getDataSourcesSearchQuery(dataSources));
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);

  const linkButton = {
    href: 'datasources/new',
    title: 'Add data source',
    disabled: !canCreateDataSource,
  };

  return (
    <PageActionBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} linkButton={linkButton} key="action-bar" />
  );
};
