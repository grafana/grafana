// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigTabProps, AppMeta } from '@grafana/ui';

interface Props extends PluginConfigTabProps<AppMeta, any> {}

export class ExampleTab1 extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    console.log('ExampleTab1', this);
  }

  render() {
    const { meta } = this.props;

    return <div>ExampleTab111111111111111: {meta.name}</div>;
  }
}
