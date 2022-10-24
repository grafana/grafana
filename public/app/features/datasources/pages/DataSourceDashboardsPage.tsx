import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { DataSourceDashboards } from '../components/DataSourceDashboards';
import { useDataSourceSettingsNav } from '../state';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function DataSourceDashboardsPage(props: Props) {
  const uid = props.match.params.uid;
  const nav = useDataSourceSettingsNav(uid, 'dashboards');

  return (
    <Page navId="datasources" pageNav={nav.main}>
      <Page.Contents>
        <DataSourceDashboards uid={uid} />
      </Page.Contents>
    </Page>
  );
}

export default DataSourceDashboardsPage;
