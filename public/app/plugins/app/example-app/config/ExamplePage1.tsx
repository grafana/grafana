// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigPageProps, AppPlugin } from '@grafana/ui';

interface Props extends PluginConfigPageProps<AppPlugin> {}

export class ExamplePage1 extends PureComponent<Props> {
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
