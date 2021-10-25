import React, { ReactElement } from 'react';
import { PluginType } from '@grafana/data';
import { CatalogPlugin } from '../../types';
import { GetStartedWithDataSource } from './GetStartedWithDataSource';
import { AccessControlAction } from 'app/types';
import { contextSrv } from 'app/core/core';

type Props = {
  plugin: CatalogPlugin;
};

export function GetStartedWithPlugin({ plugin }: Props): ReactElement | null {
  if (!plugin.isInstalled || plugin.isDisabled) {
    return null;
  }

  if (!hasProperPermissions(plugin.type)) {
    return null;
  }

  switch (plugin.type) {
    case PluginType.datasource:
      return <GetStartedWithDataSource plugin={plugin} />;
    default:
      return null;
  }
}

function hasProperPermissions(pluginType: PluginType | undefined): boolean {
  switch (pluginType) {
    case PluginType.datasource:
      return (
        contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
        contextSrv.hasPermission(AccessControlAction.DataSourcesWrite)
      );
    default:
      return true;
  }
}
