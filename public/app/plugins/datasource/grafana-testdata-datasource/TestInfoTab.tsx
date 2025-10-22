// Libraries
import { memo } from 'react';

import { PluginConfigPageProps, DataSourcePluginMeta, DataSourceJsonData } from '@grafana/data';
import { LinkButton } from '@grafana/ui';

// Types

interface Props extends PluginConfigPageProps<DataSourcePluginMeta<DataSourceJsonData>> {}

export const TestInfoTab = memo<Props>(() => {
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
});

TestInfoTab.displayName = 'TestInfoTab';
