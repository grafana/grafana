import * as React from 'react';
import { useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { DataSourceDashboards } from 'app/features/datasources/components/DataSourceDashboards';
import { useDataSourceSettingsNav } from 'app/features/datasources/state';

export function DataSourceDashboardsPage() {
  const { uid } = useParams<{ uid: string }>();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');
  const nav = useDataSourceSettingsNav(uid, pageId);

  return (
    <Page navId="connections-your-connections-datasources" pageNav={nav.main}>
      <Page.Contents>
        <DataSourceDashboards uid={uid} />
      </Page.Contents>
    </Page>
  );
}
