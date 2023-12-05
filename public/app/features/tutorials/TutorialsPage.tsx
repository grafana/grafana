import React from 'react';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

export function TutorialsPage() {
  const node: NavModelItem = {
    id: 'test-page',
    text: 'Test page',
    icon: 'dashboard',
    subTitle: 'FOR TESTING!',
    url: 'sandbox/test',
  };

  return (
    <Page navId="tutorials" navModel={{ node, main: node }}>
      <Page.Contents>
        <h1>Tutorials Page</h1>
        working?
      </Page.Contents>
    </Page>
  );
}

export default TutorialsPage;
