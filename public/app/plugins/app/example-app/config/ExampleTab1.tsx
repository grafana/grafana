// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigTabProps, AppPluginMeta } from '@grafana/ui';

interface Props extends PluginConfigTabProps<AppPluginMeta> {}

export class ExampleTab1 extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { query } = this.props;

    return (
      <div>
        11111111111111111111111111111111
        <pre>{JSON.stringify(query)}</pre>
        11111111111111111111111111111111
      </div>
    );
  }
}
