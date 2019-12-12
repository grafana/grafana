// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigPageProps, DataSourcePlugin } from '@grafana/data';
import { TestDataDataSource } from './datasource';

interface Props extends PluginConfigPageProps<DataSourcePlugin<TestDataDataSource>> {}

export class TestInfoTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div>
        See github for more information about setting up a reproducable test environment.
        <br />
        <br />
        <a
          className="btn btn-inverse"
          href="https://github.com/grafana/grafana/tree/master/devenv"
          target="_blank"
          rel="noopener"
        >
          Github
        </a>
        <br />
      </div>
    );
  }
}
