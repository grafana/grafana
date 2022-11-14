import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { useDataSource } from 'app/features/datasources/state/hooks';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const datasource = useDataSource(uid);
  const datasourcePlugin = useGetSingle(datasource.type);
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');

  return (
    <Page
      navId={'connections-your-connections-datasources'}
      pageNav={{ text: datasource.name, subTitle: `Type: ${datasourcePlugin?.name}`, active: true }}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}
