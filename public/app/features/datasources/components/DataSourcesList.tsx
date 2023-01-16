import { css } from '@emotion/css';
import React from 'react';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { LinkButton, Card, Tag, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/core';
import { StoreState, AccessControlAction, useSelector } from 'app/types';

import { getDataSources, getDataSourcesCount, useDataSourcesRoutes, useLoadDataSources } from '../state';
import { constructDataSourceExploreUrl } from '../utils';

import { DataSourcesListHeader } from './DataSourcesListHeader';

export function DataSourcesList() {
  useLoadDataSources();

  const dataSources = useSelector((state) => getDataSources(state.dataSources));
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));
  const hasFetched = useSelector(({ dataSources }: StoreState) => dataSources.hasFetched);
  const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const hasWriteRights = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);

  return (
    <DataSourcesListView
      dataSources={dataSources}
      dataSourcesCount={dataSourcesCount}
      isLoading={!hasFetched}
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

  if (isLoading) {
    return <PageLoader />;
  }

  if (dataSourcesCount === 0) {
    return (
      <EmptyListCTA
        buttonDisabled={!hasCreateRights}
        title="No data sources defined"
        buttonIcon="database"
        buttonLink={dataSourcesRoutes.New}
        buttonTitle="Add data source"
        proTip="You can also define data sources through configuration files."
        proTipLink="http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list"
        proTipLinkTitle="Learn more"
        proTipTarget="_blank"
      />
    );
  }

  return (
    <>
      {/* List Header */}
      <DataSourcesListHeader />

      {/* List */}
      <ul className={styles.list}>
        {dataSources.map((dataSource) => {
          const dsLink = config.appSubUrl + dataSourcesRoutes.Edit.replace(/:uid/gi, dataSource.uid);
          return (
            <li key={dataSource.uid}>
              <Card href={hasWriteRights ? dsLink : undefined}>
                <Card.Heading>{dataSource.name}</Card.Heading>
                <Card.Figure>
                  <img src={dataSource.typeLogoUrl} alt="" height="40px" width="40px" className={styles.logo} />
                </Card.Figure>
                <Card.Meta>
                  {[
                    dataSource.typeName,
                    dataSource.url,
                    dataSource.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />,
                  ]}
                </Card.Meta>
                <Card.Tags>
                  <LinkButton
                    icon="apps"
                    fill="outline"
                    variant="secondary"
                    href={`dashboard/new-with-ds/${dataSource.uid}`}
                  >
                    Build a dashboard
                  </LinkButton>
                  {hasExploreRights && (
                    <LinkButton
                      icon="compass"
                      fill="outline"
                      variant="secondary"
                      className={styles.button}
                      href={constructDataSourceExploreUrl(dataSource)}
                    >
                      Explore
                    </LinkButton>
                  )}
                </Card.Tags>
              </Card>
            </li>
          );
        })}
      </ul>
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
    logo: css({
      objectFit: 'contain',
    }),
    button: css({
      marginLeft: theme.spacing(2),
    }),
  };
};
