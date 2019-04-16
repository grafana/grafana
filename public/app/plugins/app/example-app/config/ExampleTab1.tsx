// Libraries
import React, { PureComponent } from 'react';

// Types
import { AppPlugin, PluginConfigPageProps } from '@grafana/ui';

interface Props extends PluginConfigPageProps<AppPlugin> {}

export class ExampleTab1 extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    console.log('Constructor', this);
  }

  render() {
    const { plugin } = this.props;

    return <div>Hello from the example Config Page: {plugin.meta.name}</div>;
  }
}
