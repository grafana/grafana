import React, { ReactElement } from 'react';

import { PluginType } from '@grafana/data';

import { CatalogPlugin } from '../../types';

import { GetStartedWithApp } from './GetStartedWithApp';
import { GetStartedWithDataSource } from './GetStartedWithDataSource';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithPlugin({ plugin }: Props): ReactElement | null {
  if (!plugin.isInstalled || plugin.isDisabled) {
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
