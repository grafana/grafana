// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigPageProps, AppPlugin } from '@grafana/data';
import { ExampleAppSettings } from 'types';

interface Props extends PluginConfigPageProps<AppPlugin<ExampleAppSettings>> {}

export class ExamplePage2 extends PureComponent<Props> {
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
