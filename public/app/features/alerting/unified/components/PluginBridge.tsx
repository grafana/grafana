import React, { FC, ReactElement } from 'react';
import { useAsync } from 'react-use';

import { getPluginSettings } from 'app/features/plugins/pluginSettings';

export interface PluginBridgeProps {
  plugin: SupportedPlugin;
  // shows an optional component when the plugin is not installed
  notInstalledComponent?: ReactElement;
  // shows an optional component when we're checking if the plugin is installed
  loadingComponent?: ReactElement;
}

export enum SupportedPlugin {
  Incident = 'grafana-incident-app',
  OnCall = 'grafana-oncall-app',
  MachineLearning = 'grafana-ml-app',
}

export const PluginBridge: FC<PluginBridgeProps> = ({ children, plugin, loadingComponent, notInstalledComponent }) => {
  const { loading, error } = useAsync(() => getPluginSettings(plugin, { showErrorAlert: false }));

  if (loading) {
    return loadingComponent ?? null;
  }

  if (error) {
    return notInstalledComponent ?? null;
  }

  return <>{children}</>;
};

export function createBridgeURL(plugin: SupportedPlugin, path?: string, options?: Record<string, string>) {
  const searchParams = new URLSearchParams(options).toString();
  const pluginPath = `/a/${plugin}${path}`;

  return pluginPath + (searchParams ? '?' + searchParams : '');
}
