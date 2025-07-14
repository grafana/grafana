import * as React from 'react';
import { AppRootProps } from '@grafana/data';

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return <div className="page-container">Hello Grafana!</div>;
  }
}
