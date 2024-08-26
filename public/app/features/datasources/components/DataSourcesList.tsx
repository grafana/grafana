import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { DataSourceSettings, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { EmptyState, LinkButton, TextLink, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
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
  const hasExploreRights = contextSrv.hasAccessToExplore();

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
      <EmptyState
        variant="call-to-action"
        button={
          <LinkButton disabled={!hasCreateRights} href={dataSourcesRoutes.New} icon="database" size="lg">
            <Trans i18nKey="data-source-list.empty-state.button-title">Add data source</Trans>
          </LinkButton>
        }
        message={t('data-source-list.empty-state.title', 'No data sources defined')}
      >
        <Trans i18nKey="data-source-list.empty-state.pro-tip">
          You can also define data sources through configuration files.{' '}
          <TextLink
            external
            href="http://docs.grafana.org/administration/provisioning/?utm_source=grafana_ds_list#data-sources"
          >
            Learn more
          </TextLink>
        </Trans>
      </EmptyState>
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
      {dataSources.length === 0 && !isLoading ? (
        <EmptyState variant="not-found" message={t('data-sources.empty-state.message', 'No data sources found')} />
      ) : (
        <ul className={styles.list}>{getDataSourcesList()}</ul>
      )}
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
