import * as React from 'react';
import { AppRootProps } from '@grafana/data';
import { testIds } from '../../../../testIds';

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return (
      <div data-testid={testIds.appA.container} className="page-container">
        Hello Grafana!!!!!
      </div>
    );
  }
}
