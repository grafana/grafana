import { css } from '@emotion/css';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CellProps, Stack, Text, Icon, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { Trans } from 'app/core/internationalization';
import { useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';

import { useGetDashboardByUidQuery } from '../api';

import { ResourceTableItem } from './types';

export function NameCell(props: CellProps<ResourceTableItem>) {
  const data = props.row.original;

  return (
    <Stack direction="row" gap={2} alignItems="center">
      <ResourceIcon resource={data} />

      <Stack direction="column" gap={0}>
        <ResourceInfo data={data} />
      </Stack>
    </Stack>
  );
}

function ResourceInfo({ data }: { data: ResourceTableItem }) {
  switch (data.type) {
    case 'DASHBOARD':
      return <DashboardInfo data={data} />;
    case 'DATASOURCE':
      return <DatasourceInfo data={data} />;
    case 'FOLDER':
      return <FolderInfo data={data} />;
  }
}

function getDashboardTitle(dashboardData: object) {
  if ('title' in dashboardData && typeof dashboardData.title === 'string') {
    return dashboardData.title;
  }

  return undefined;
}

function DatasourceInfo({ data }: { data: ResourceTableItem }) {
  const datasourceUID = data.refId;
  const datasource = useDatasource(datasourceUID);

  if (!datasource) {
    return (
      <>
        <Text>
          <Trans i18nKey="migrate-to-cloud.resource-table.unknown-datasource-title">
            Data source {{ datasourceUID }}
          </Trans>
        </Text>
        <Text color="secondary">
          <Trans i18nKey="migrate-to-cloud.resource-table.unknown-datasource-type">Unknown data source</Trans>
        </Text>
      </>
    );
  }

  return (
    <>
      <span>{datasource.name}</span>
      <Text color="secondary">{datasource.type}</Text>
    </>
  );
}

function DashboardInfo({ data }: { data: ResourceTableItem }) {
  const dashboardUID = data.refId;
  // TODO: really, the API should return this directly
  const { data: dashboardData, isError } = useGetDashboardByUidQuery({
    uid: dashboardUID,
  });

  const dashboardName = useMemo(() => {
    return (dashboardData?.dashboard && getDashboardTitle(dashboardData.dashboard)) ?? dashboardUID;
  }, [dashboardData, dashboardUID]);

  if (isError) {
    // Not translated because this is only temporary until the data comes through in the MigrationRun API
    return (
      <>
        <Text italic>Unable to load dashboard</Text>
        <Text color="secondary">Dashboard {dashboardUID}</Text>
      </>
    );
  }

  if (!dashboardData) {
    return <InfoSkeleton />;
  }

  return (
    <>
      <span>{dashboardName}</span>
      <Text color="secondary">{dashboardData.meta?.folderTitle ?? 'Dashboards'}</Text>
    </>
  );
}

function FolderInfo({ data }: { data: ResourceTableItem }) {
  const { data: folderData, isLoading, isError } = useGetFolderQuery(data.refId);

  if (isLoading || !folderData) {
    return <InfoSkeleton />;
  }

  if (isError) {
    return (
      <>
        <Text italic>Unable to load dashboard</Text>
        <Text color="secondary">Dashboard {data.refId}</Text>
      </>
    );
  }

  const parentFolderName = folderData.parents?.[folderData.parents.length - 1]?.title;

  return (
    <>
      <span>{folderData.title}</span>
      <Text color="secondary">{parentFolderName ?? 'Dashboards'}</Text>
    </>
  );
}

function InfoSkeleton() {
  return (
    <>
      <Skeleton width={250} />
      <Skeleton width={130} />
    </>
  );
}

function ResourceIcon({ resource }: { resource: ResourceTableItem }) {
  const styles = useStyles2(getIconStyles);
  const datasource = useDatasource(resource.type === 'DATASOURCE' ? resource.refId : undefined);

  if (resource.type === 'DASHBOARD') {
    return <Icon size="xl" name="dashboard" />;
  } else if (resource.type === 'FOLDER') {
    return <Icon size="xl" name="folder" />;
  } else if (resource.type === 'DATASOURCE' && datasource?.meta?.info?.logos?.small) {
    return <img className={styles.icon} src={datasource.meta.info.logos.small} alt="" />;
  } else if (resource.type === 'DATASOURCE') {
    return <Icon size="xl" name="database" />;
  }

  return undefined;
}

function getIconStyles() {
  return {
    icon: css({
      display: 'block',
      width: getSvgSize('xl'),
      height: getSvgSize('xl'),
    }),
  };
}

function useDatasource(datasourceUID: string | undefined): DataSourceInstanceSettings | undefined {
  const datasource = useMemo(() => {
    if (!datasourceUID) {
      return undefined;
    }

    return (
      config.datasources[datasourceUID] || Object.values(config.datasources).find((ds) => ds.uid === datasourceUID)
    );
  }, [datasourceUID]);

  return datasource;
}
