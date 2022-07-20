import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AnyAction } from 'redux';

import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, StoreState } from 'app/types';

import { getDataSourcesSearchQuery, setDataSourcesSearchQuery } from '../state';

export function DataSourcesListHeader() {
  const dispatch = useDispatch();
  const setSearchQuery = useCallback((q: string) => dispatch(setDataSourcesSearchQuery(q)), [dispatch]);
  const searchQuery = useSelector(({ dataSources }: StoreState) => getDataSourcesSearchQuery(dataSources));
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);

  return (
    <DataSourcesListHeaderView
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      canCreateDataSource={canCreateDataSource}
    />
  );
}

export type ViewProps = {
  searchQuery: string;
  setSearchQuery: (q: string) => AnyAction;
  canCreateDataSource: boolean;
};

export function DataSourcesListHeaderView({ searchQuery, setSearchQuery, canCreateDataSource }: ViewProps) {
  const linkButton = {
    href: 'datasources/new',
    title: 'Add data source',
    disabled: !canCreateDataSource,
  };

  return (
    <PageActionBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} linkButton={linkButton} key="action-bar" />
  );
}
