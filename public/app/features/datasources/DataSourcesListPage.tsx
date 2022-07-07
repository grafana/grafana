import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IconName } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import { contextSrv } from 'app/core/core';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState, AccessControlAction } from 'app/types';

import DataSourcesList from './DataSourcesList';
import { DataSourcesListHeader } from './DataSourcesListHeader';
import { loadDataSources } from './state/actions';
import { getDataSourcesCount } from './state/selectors';

const emptyListModel = {
  title: 'No data sources defined',
  buttonIcon: 'database' as IconName,
  buttonLink: 'datasources/new',
  buttonTitle: 'Add data source',
  proTip: 'You can also define data sources through configuration files.',
  proTipLink: 'http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list',
  proTipLinkTitle: 'Learn more',
  proTipTarget: '_blank',
};

export const DataSourcesListPage = () => {
  const dispatch = useDispatch();
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));
  const hasFetched = useSelector(({ dataSources }: StoreState) => dataSources.hasFetched);
  const navModel = useSelector(({ navIndex }: StoreState) => getNavModel(navIndex, 'datasources'));
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

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={!hasFetched}>
        <>
          {hasFetched && dataSourcesCount === 0 && <EmptyListCTA {...emptyList} />}
          {hasFetched && dataSourcesCount > 0 && (
            <>
              <DataSourcesListHeader />
              <DataSourcesList key="list" />
            </>
          )}
        </>
      </Page.Contents>
    </Page>
  );
};

export default DataSourcesListPage;
