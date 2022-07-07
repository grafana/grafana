import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IconName } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/core';
import { StoreState, AccessControlAction } from 'app/types';

import DataSourcesList from './DataSourcesList';
import { DataSourcesListHeader } from './DataSourcesListHeader';
import { loadDataSources } from './state/actions';
import { getDataSourcesCount } from './state/selectors';

const buttonIcon: IconName = 'database';
const emptyListModel = {
  title: 'No data sources defined',
  buttonIcon,
  buttonLink: 'datasources/new',
  buttonTitle: 'Add data source',
  proTip: 'You can also define data sources through configuration files.',
  proTipLink: 'http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list',
  proTipLinkTitle: 'Learn more',
  proTipTarget: '_blank',
};

export const DataSourcesListPageContent = () => {
  const dispatch = useDispatch();
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));
  const hasFetched = useSelector(({ dataSources }: StoreState) => dataSources.hasFetched);
  const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const emptyList = {
    ...emptyListModel,
    buttonDisabled: !canCreateDataSource,
  };

  useEffect(() => {
    if (!hasFetched) {
      dispatch(loadDataSources());
    }
  }, [dispatch, hasFetched]);

  if (!hasFetched) {
    return <PageLoader />;
  }

  if (dataSourcesCount === 0) {
    return <EmptyListCTA {...emptyList} />;
  }

  return (
    <>
      <DataSourcesListHeader />
      <DataSourcesList key="list" />
    </>
  );
};
