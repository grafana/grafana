import * as React from 'react';
import { AppRootProps } from '@grafana/data';
import { AddedLinks } from './AddedLinks';
import { testIds } from '../../../../testIds';

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return (
      <div data-testid={testIds.appC.container} className="page-container">
        Hello Grafana!
        <AddedLinks></AddedLinks>
      </div>
    );
  }
}
