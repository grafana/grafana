// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigTabProps, DataSourcePlugin } from '@grafana/ui';
import { TestDataDatasource } from './datasource';

interface Props extends PluginConfigTabProps<DataSourcePlugin<TestDataDatasource>> {}

export class TestInfoTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div>
        See githb for more information about setting up a reproducable test environment.
        <br />
        <br />
        <a className="btn btn-inverse" href="https://github.com/grafana/grafana/tree/master/devenv" target="_blank">
          Github
        </a>
        <br />
      </div>
    );
  }
}
