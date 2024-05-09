import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

// @todo: replace barrel import path
import { AddNewConnection } from '../tabs/ConnectData/index';

export function AddNewConnectionPage() {
  return (
    <Page navId={'connections-add-new-connection'}>
      <Page.Contents>
        <AddNewConnection />
      </Page.Contents>
    </Page>
  );
}
