import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { CellProps, Stack, Text, Icon, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';

import { useGetDashboardByUidQuery } from '../api';
import { MigrationResourceDTOMock, MigrationResourceDatasource, MigrationResourceDashboard } from '../mockAPI';

export function NameCell(props: CellProps<MigrationResourceDTOMock>) {
  const data = props.row.original;

  return (
    <Stack direction="row" gap={2} alignItems="center">
      <ResourceIcon resource={data} />

      <Stack direction="column" gap={0}>
        {data.type === 'datasource' ? <DatasourceInfo data={data} /> : <DashboardInfo data={data} />}
      </Stack>
    </Stack>
  );
}

function getDashboardTitle(dashboardData: object) {
  if ('title' in dashboardData && typeof dashboardData.title === 'string') {
    return dashboardData.title;
  }

  return undefined;
}

function DatasourceInfo({ data }: { data: MigrationResourceDatasource }) {
  return (
    <>
      <span>{data.resource.name}</span>
      <Text color="secondary">{data.resource.type}</Text>
    </>
  );
}

// TODO: really, the API should return this directly
function DashboardInfo({ data }: { data: MigrationResourceDashboard }) {
  const { data: dashboardData, isError } = useGetDashboardByUidQuery({
    uid: data.resource.uid,
  });

  const dashboardName = useMemo(() => {
    return (dashboardData?.dashboard && getDashboardTitle(dashboardData.dashboard)) ?? data.resource.uid;
  }, [dashboardData, data.resource.uid]);

  if (isError) {
    return (
      <>
        <Text italic>Unable to load dashboard</Text>
        <Text color="secondary">Dashboard {data.uid}</Text>
      </>
    );
  }

  if (!dashboardData) {
    return (
      <>
        <Skeleton width={250} />
        <Skeleton width={130} />
      </>
    );
  }

  return (
    <>
      <span>{dashboardName}</span>
      <Text color="secondary">{dashboardData.meta?.folderTitle ?? 'Dashboards'}</Text>
    </>
  );
}

function ResourceIcon({ resource }: { resource: MigrationResourceDTOMock }) {
  const styles = useStyles2(getIconStyles);

  if (resource.type === 'dashboard') {
    return <Icon size="xl" name="dashboard" />;
  }

  if (resource.type === 'datasource' && resource.resource.icon) {
    return <img className={styles.icon} src={resource.resource.icon} alt="" />;
  } else if (resource.type === 'datasource') {
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
