import React, { FC, ReactElement } from 'react';
import { useAsync } from 'react-use';

import { getPluginSettings } from '../services/PluginService';

export enum SupportedPlugin {
  Incident = 'grafana-incident-app',
  OnCall = 'grafana-oncall-app',
  MachineLearning = 'grafana-ml-app',
}

export type PluginID = SupportedPlugin | string;

export interface PluginBridgeProps {
  plugin: PluginID;
  // shows an optional component when the plugin is not installed
  notInstalledComponent?: ReactElement;
  // shows an optional component when we're checking if the plugin is installed
  loadingComponent?: ReactElement;
}

export const PluginBridge: FC<PluginBridgeProps> = ({ children, plugin, loadingComponent, notInstalledComponent }) => {
  const { loading, error, value } = useAsync(() => getPluginSettings(plugin, { showErrorAlert: false }));

  if (loading) {
    return loadingComponent ?? null;
  }

  const installed = value && !error && !loading;
  const enabled = value?.enabled;

  if (!installed || !enabled) {
    return notInstalledComponent ?? null;
  }

  return <>{children}</>;
};

export function createBridgeURL(plugin: PluginID, path?: string, options?: Record<string, string>) {
  const searchParams = new URLSearchParams(options).toString();
  const pluginPath = `/a/${plugin}${path}`;

  return pluginPath + (searchParams ? '?' + searchParams : '');
}
