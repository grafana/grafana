import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/core';
import { StoreState, AccessControlAction, useSelector } from 'app/types';

import { getDataSources, getDataSourcesCount, useDataSourcesRoutes, useLoadDataSources } from '../state';
import { trackDataSourcesListViewed } from '../tracking';

import { DataSourcesListCard } from './DataSourcesListCard';
import { DataSourcesListHeader } from './DataSourcesListHeader';

export function DataSourcesList() {
  const { isLoading } = useLoadDataSources();

  const dataSources = useSelector((state) => getDataSources(state.dataSources));
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));
  const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const hasWriteRights = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  return (
    <DataSourcesListView
      dataSources={dataSources}
      dataSourcesCount={dataSourcesCount}
      isLoading={isLoading}
      hasCreateRights={hasCreateRights}
      hasWriteRights={hasWriteRights}
      hasExploreRights={hasExploreRights}
    />
  );
}

export type ViewProps = {
  dataSources: DataSourceSettings[];
  dataSourcesCount: number;
  isLoading: boolean;
  hasCreateRights: boolean;
  hasWriteRights: boolean;
  hasExploreRights: boolean;
};

export function DataSourcesListView({
  dataSources,
  dataSourcesCount,
  isLoading,
  hasCreateRights,
  hasWriteRights,
  hasExploreRights,
}: ViewProps) {
  const styles = useStyles2(getStyles);
  const dataSourcesRoutes = useDataSourcesRoutes();
  const location = useLocation();

  useEffect(() => {
    trackDataSourcesListViewed({
      grafana_version: config.buildInfo.version,
      path: location.pathname,
    });
  }, [location]);

  if (!isLoading && dataSourcesCount === 0) {
    return (
      <EmptyListCTA
        buttonDisabled={!hasCreateRights}
        title="No data sources defined"
        buttonIcon="database"
        buttonLink={dataSourcesRoutes.New}
        buttonTitle="Add data source"
        proTip="You can also define data sources through configuration files."
        proTipLink="http://docs.grafana.org/administration/provisioning/?utm_source=grafana_ds_list#data-sources"
        proTipLinkTitle="Learn more"
        proTipTarget="_blank"
      />
    );
  }

  const getDataSourcesList = () => {
    if (isLoading) {
      return new Array(20)
        .fill(null)
        .map((_, index) => <DataSourcesListCard.Skeleton key={index} hasExploreRights={hasExploreRights} />);
    }

    return dataSources.map((dataSource) => (
      <li key={dataSource.uid}>
        <DataSourcesListCard
          dataSource={dataSource}
          hasWriteRights={hasWriteRights}
          hasExploreRights={hasExploreRights}
        />
      </li>
    ));
  };

  return (
    <>
      {/* List Header */}
      <DataSourcesListHeader />

      {/* List */}
      <ul className={styles.list}>{getDataSourcesList()}</ul>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    list: css({
      listStyle: 'none',
      display: 'grid',
      // gap: '8px', Add back when legacy support for old Card interface is dropped
    }),
  };
};
