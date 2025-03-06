import React from 'react';
import { testIds } from '../components/testIds';
import { PluginPage } from '@grafana/runtime';

function PageTwo() {
  return (
    <PluginPage>
      <div data-testid={testIds.pageTwo.container}>
        <p>This is page two.</p>
      </div>
    </PluginPage>
  );
}

export default PageTwo;
