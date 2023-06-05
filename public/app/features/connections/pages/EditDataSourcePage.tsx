import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';

import { useDataSourceSettingsNav } from '../hooks/useDataSourceSettingsNav';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');
  const { navId, pageNav } = useDataSourceSettingsNav();

  return (
    <Page
      navId={navId}
      pageNav={pageNav}
      actions={config.featureToggles.topnav ? <EditDataSourceActions uid={uid} /> : undefined}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}
