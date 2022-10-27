import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { StoreState, useSelector } from 'app/types';

export function DataSourceDetailsPage() {
  const overrideNavId = 'standalone-plugin-page-/connections/connect-data';
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const isConnectDataPageOverriden = Boolean(navIndex[overrideNavId]);
  const navId = isConnectDataPageOverriden ? overrideNavId : 'connections-connect-data'; // The nav id changes (gets a prefix) if it is overriden by a plugin

  return (
    <Page
      navId={navId}
      pageNav={{
        text: 'Datasource details',
        subTitle: 'This is going to be the details page for a datasource',
        active: true,
      }}
    >
      <Page.Contents>Data Source Details (no exposed component from plugins yet)</Page.Contents>
    </Page>
  );
}
