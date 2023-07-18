import * as React from 'react';
import { useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';

import { DataSourceDashboards } from '../components/DataSourceDashboards';
import { useDataSourceSettingsNav } from '../hooks/useDataSourceSettingsNav';

export function DataSourceDashboardsPage() {
  const { uid } = useParams<{ uid: string }>();
  const { navId, pageNav } = useDataSourceSettingsNav();

  return (
    <Page navId={navId} pageNav={pageNav}>
      <Page.Contents>
        <DataSourceDashboards uid={uid} />
      </Page.Contents>
    </Page>
  );
}
