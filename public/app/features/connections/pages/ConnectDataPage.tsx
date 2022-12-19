import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { ConnectData } from '../tabs/ConnectData';

export function ConnectDataPage() {
  return (
    <Page navId={'connections-connect-data'}>
      <Page.Contents>
        <ConnectData />
      </Page.Contents>
    </Page>
  );
}
