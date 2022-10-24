import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');

  return (
    // TODO: make sure to use the correct nav id here (breadcrumbs?)
    // Also figure out how we can make the page title and the breadcumbs dynamic (using the plugins name) - only with navModel?
    <Page navId={'connections-your-connections-datasources'}>
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}
