// Libraries
import React, { PureComponent } from 'react';

// Types
import { AppRootPageProps } from '@grafana/ui';

export class ExampleRootPage extends PureComponent<AppRootPageProps> {
  constructor(props: AppRootPageProps) {
    super(props);

    console.log('Constructor', this);
  }

  componentDidMount() {
    // const { onNavChanged } = this.props;
    // onNavChanged({ xxx: 'TODO, this would be the Nav Model' });
  }

  componentDidUpdate(prevProps: AppRootPageProps) {
    if (this.props.query !== prevProps.query) {
      console.log('Query Changed in App Page: ', this.props.query);
    }
  }

  render() {
    const { plugin, path, query } = this.props;

    return (
      <div>
        222222: {plugin.meta.name} QUERY: <pre>{JSON.stringify(query)}</pre>
        <br />
        <ul>
          <li>
            <a href={path + '?x=1'}>111</a>
          </li>
          <li>
            <a href={path + '?x=AAA'}>AAA</a>
          </li>
          <li>
            <a href={path + '?x=1&y=2&y=3'}>ZZZ</a>
          </li>
        </ul>
      </div>
    );
  }
}
