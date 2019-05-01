// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigTabProps, AppPluginMeta } from '@grafana/ui';

interface Props extends PluginConfigTabProps<AppPluginMeta> {}

export class ExampleConfigPage extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    console.log('Constructor', this);
  }

  render() {
    const { meta } = this.props;

    return <div>Hello from the example Config Page: {meta.name}</div>;
  }
}
