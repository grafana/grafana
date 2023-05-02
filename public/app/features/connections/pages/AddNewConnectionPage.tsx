import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { AddNewConnection } from '../tabs/ConnectData';

export function AddNewConnectionPage() {
  return (
    <Page navId={'connections-add-new-connection'}>
      <Page.Contents>
        <AddNewConnection />
      </Page.Contents>
    </Page>
  );
}
