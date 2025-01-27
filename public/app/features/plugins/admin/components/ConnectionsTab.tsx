import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { EmptyState, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { ViewProps } from 'app/features/datasources/components/DataSourcesList';
import { DataSourcesListCard } from 'app/features/datasources/components/DataSourcesListCard';
import { getDataSources, useLoadDataSources } from 'app/features/datasources/state';
import { AccessControlAction, useSelector } from 'app/types';

import { CatalogPlugin } from '../types';

import { GetStartedWithDataSource } from './GetStartedWithPlugin/GetStartedWithDataSource';

interface Props {
  plugin: CatalogPlugin;
}

export default function ConnectionsTab({ plugin }: Props) {
  const { isLoading } = useLoadDataSources();

  const allDataSources = useSelector((state) => getDataSources(state.dataSources));
  const dataSources = allDataSources.filter((ds) => ds.type === plugin.id);
  const hasWriteRights = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const hasExploreRights = contextSrv.hasAccessToExplore();

  return (
    <ConnectionsList
      dataSources={dataSources}
      dataSourcesCount={dataSources.length}
      isLoading={isLoading}
      plugin={plugin}
      hasWriteRights={hasWriteRights}
      hasExploreRights={hasExploreRights}
    />
  );
}

type ListProps = Omit<ViewProps, 'hasCreateRights'> & {
  plugin: CatalogPlugin;
};

export function ConnectionsList({
  dataSources,
  dataSourcesCount,
  isLoading,
  hasWriteRights,
  hasExploreRights,
  plugin,
}: ListProps) {
  const styles = useStyles2(getStyles);

  if (!isLoading && dataSourcesCount === 0) {
    return (
      <EmptyState
        variant="call-to-action"
        button={<GetStartedWithDataSource plugin={plugin} />}
        message={t('data-source-list.empty-state.title', 'No data sources defined')}
      />
    );
  }

  const getDataSourcesList = () => {
    if (isLoading) {
      return new Array(5)
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
    <Stack direction="column" gap={2}>
      <span>
        <Trans i18nKey="plugins.details.connections-tab.description" values={{ pluginName: plugin.name }}>
          The data source connections below are all {'{{pluginName}}'}. You can find all of your data source connections
          of all types in{' '}
          <TextLink href="/connections/datasources">
            <Trans i18nKey="nav.connections.title">Connections</Trans> -{' '}
            <Trans i18nKey="nav.data-sources.title">Data sources</Trans>.
          </TextLink>
        </Trans>
      </span>
      <ul className={styles.list}>{getDataSourcesList()}</ul>
    </Stack>
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
