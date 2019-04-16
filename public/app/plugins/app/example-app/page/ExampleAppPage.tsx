// Libraries
import React, { PureComponent } from 'react';

// Types
import { AppPlugin, AppPluginPageProps } from '@grafana/ui';

interface Props extends AppPluginPageProps<AppPlugin> {}

export class ExampleAppPage extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    console.log('Constructor', this);
  }

  componentDidMount() {
    const { onNavChanged } = this.props;
    onNavChanged({ xxx: 'TODO, this would be the Nav Model' });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.query !== prevProps.query) {
      console.log('Query Changed: ', this.props.query);
    }
  }

  render() {
    const { plugin, url, query } = this.props;

    return (
      <div>
        Hello from the example App Page: {plugin.meta.name}
        QUERY: {query}
        <br />
        PATH: {url}
        <br />
      </div>
    );
  }
}
