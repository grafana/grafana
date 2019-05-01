// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigTabProps, AppPluginMeta } from '@grafana/ui';

interface Props extends PluginConfigTabProps<AppPluginMeta> {}

export class ExampleTab2 extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { query } = this.props;

    return (
      <div>
        22222222222222222222222222222222
        <pre>{JSON.stringify(query)}</pre>
        22222222222222222222222222222222
      </div>
    );
  }
}
