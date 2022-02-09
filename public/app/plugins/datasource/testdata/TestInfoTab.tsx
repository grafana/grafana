// Libraries
import React, { PureComponent } from 'react';
import { LinkButton } from '@grafana/ui';

// Types
import { PluginConfigPageProps, DataSourcePluginMeta, DataSourceJsonData } from '@grafana/data';

interface Props extends PluginConfigPageProps<DataSourcePluginMeta<DataSourceJsonData>> {}

export class TestInfoTab extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div>
        See github for more information about setting up a reproducible test environment.
        <br />
        <br />
        <LinkButton
          variant="secondary"
          href="https://github.com/grafana/grafana/tree/main/devenv"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </LinkButton>
        <br />
      </div>
    );
  }
}
