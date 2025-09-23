import { ReactElement } from 'react';

import { PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin } from '../../types';

import { GetStartedWithApp } from './GetStartedWithApp';
import { GetStartedWithDataSource } from './GetStartedWithDataSource';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithPlugin({ plugin }: Props): ReactElement | null {
  const isInstalled = config.pluginAdminExternalManageEnabled ? plugin.isFullyInstalled : plugin.isInstalled;

  if (!isInstalled || plugin.isDisabled) {
    return null;
  }

  switch (plugin.type) {
    case PluginType.datasource:
      return <GetStartedWithDataSource plugin={plugin} />;
    case PluginType.app:
      return <GetStartedWithApp plugin={plugin} />;
    default:
      return null;
  }
}
