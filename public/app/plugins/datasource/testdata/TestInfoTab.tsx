// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigTabProps, DataSourcePlugin } from '@grafana/ui';

interface Props extends PluginConfigTabProps<DataSourcePlugin> {}

export class TestInfoTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div>
        TODO... make this a useful help page...
        <br />
        <br />
        Describe installing the docker test environment too...
        <br />
        <br />
      </div>
    );
  }
}
