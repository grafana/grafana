import { css } from '@emotion/css';
import { useMemo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { CellProps, Stack, Text, Icon, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { Trans } from 'app/core/internationalization';
import { useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';

import { useGetDashboardByUidQuery, useGetLibraryElementByUidQuery } from '../api';

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
    case 'LIBRARY_ELEMENT':
      return <LibraryElementInfo data={data} />;
    // Starting from 11.4.x, new resources have both `name` and optionally a `parentName`, so we can use this catch-all component.
    default:
      return <BasicResourceInfo data={data} />;
  }
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

function getTitleFromDashboardJSON(dashboardData: object | undefined): string | null {
  if (dashboardData && 'title' in dashboardData && typeof dashboardData.title === 'string') {
    return dashboardData.title;
  }

  return null;
}

function DashboardInfo({ data }: { data: ResourceTableItem }) {
  const dashboardUID = data.refId;
  const skipApiCall = !!data.name && !!data.parentName;
  const {
    data: dashboardData,
    isLoading,
    isError,
  } = useGetDashboardByUidQuery({ uid: dashboardUID }, { skip: skipApiCall });

  const dashboardName = data.name || getTitleFromDashboardJSON(dashboardData?.dashboard) || dashboardUID;
  const dashboardParentName = data.parentName || dashboardData?.meta?.folderTitle || 'Dashboards';

  if (isError) {
    return (
      <>
        <Text italic>
          <Trans i18nKey="migrate-to-cloud.resource-table.dashboard-load-error">Unable to load dashboard</Trans>
        </Text>
        <Text color="secondary">Dashboard {dashboardUID}</Text>
      </>
    );
  }

  if (isLoading) {
    return <InfoSkeleton />;
  }

  return (
    <>
      <span>{dashboardName}</span>
      <Text color="secondary">{dashboardParentName}</Text>
    </>
  );
}

function FolderInfo({ data }: { data: ResourceTableItem }) {
  const folderUID = data.refId;
  const skipApiCall = !!data.name && !!data.parentName;

  const { data: folderData, isLoading, isError } = useGetFolderQuery(folderUID, { skip: skipApiCall });

  const folderName = data.name || folderData?.title;
  const folderParentName = data.parentName || folderData?.parents?.[folderData.parents.length - 1]?.title;

  if (isError) {
    return (
      <>
        <Text italic>Unable to load folder</Text>
        <Text color="secondary">Folder {data.refId}</Text>
      </>
    );
  }

  if (isLoading) {
    return <InfoSkeleton />;
  }

  return (
    <>
      <span>{folderName}</span>
      <Text color="secondary">{folderParentName ?? 'Dashboards'}</Text>
    </>
  );
}

function LibraryElementInfo({ data }: { data: ResourceTableItem }) {
  const uid = data.refId;
  const skipApiCall = !!data.name && !!data.parentName;

  const {
    data: libraryElementData,
    isError,
    isLoading,
  } = useGetLibraryElementByUidQuery({ libraryElementUid: uid }, { skip: skipApiCall });

  const name = data.name || libraryElementData?.result?.name || uid;
  const parentName = data.parentName || libraryElementData?.result?.meta?.folderName || 'General';

  if (isError) {
    return (
      <>
        <Text italic>
          <Trans i18nKey="migrate-to-cloud.resource-table.error-library-element-title">
            Unable to load library element
          </Trans>
        </Text>

        <Text color="secondary">
          <Trans i18nKey="migrate-to-cloud.resource-table.error-library-element-sub">Library Element {uid}</Trans>
        </Text>
      </>
    );
  }

  if (isLoading) {
    return <InfoSkeleton />;
  }

  return (
    <>
      <span>{name}</span>
      <Text color="secondary">{parentName}</Text>
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

function BasicResourceInfo({ data }: { data: ResourceTableItem }) {
  return (
    <>
      <span>{data.name}</span>
      {data.parentName && <Text color="secondary">{data.parentName}</Text>}
    </>
  );
}

function ResourceIcon({ resource }: { resource: ResourceTableItem }) {
  const styles = useStyles2(getIconStyles);
  const datasource = useDatasource(resource.type === 'DATASOURCE' ? resource.refId : undefined);

  switch (resource.type) {
    case 'DASHBOARD':
      return <Icon size="xl" name="dashboard" />;
    case 'FOLDER':
      return <Icon size="xl" name="folder" />;
    case 'DATASOURCE':
      if (datasource?.meta?.info?.logos?.small) {
        return <img className={styles.icon} src={datasource.meta.info.logos.small} alt="" />;
      }

      return <Icon size="xl" name="database" />;
    case 'LIBRARY_ELEMENT':
      return <Icon size="xl" name="library-panel" />;
    case 'MUTE_TIMING':
      return <Icon size="xl" name="bell" />;
    case 'NOTIFICATION_TEMPLATE':
      return <Icon size="xl" name="bell" />;
    case 'CONTACT_POINT':
      return <Icon size="xl" name="bell" />;
    case 'NOTIFICATION_POLICY':
      return <Icon size="xl" name="bell" />;
    case 'ALERT_RULE':
      return <Icon size="xl" name="bell" />;
    default:
      return undefined;
  }
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
