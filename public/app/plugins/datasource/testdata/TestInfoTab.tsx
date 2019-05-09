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
        <br />
        See <a href="https://github.com/grafana/grafana/tree/master/devenv">github</a> for information about setting up
        a reproducable test environment for grafana.
        <br />
        <br />
      </div>
    );
  }
}
