import React, { FC, ReactElement } from 'react';
import { useAsync } from 'react-use';

import { PluginMeta } from '@grafana/data';
import { getPluginSettings } from 'app/features/plugins/pluginSettings';

export enum SupportedPlugin {
  Incident = 'grafana-incident-app',
  OnCall = 'grafana-oncall-app',
  MachineLearning = 'grafana-ml-app',
}

export type PluginID = SupportedPlugin | string;

export interface PluginBridgeProps {
  plugin: PluginID;
  // shows an optional component when the plugin is not installed
  notInstalledFallback?: ReactElement;
  // shows an optional component when we're checking if the plugin is installed
  loadingComponent?: ReactElement;
}

interface PluginBridgeHookResponse {
  loading: boolean;
  installed?: boolean;
  error?: Error;
  settings?: PluginMeta<{}>;
}

export const PluginBridge: FC<PluginBridgeProps> = ({ children, plugin, loadingComponent, notInstalledFallback }) => {
  const { loading, installed } = usePluginBridge(plugin);

  if (loading) {
    return loadingComponent ?? null;
  }

  if (!installed) {
    return notInstalledFallback ?? null;
  }

  return <>{children}</>;
};

export function usePluginBridge(plugin: PluginID): PluginBridgeHookResponse {
  const { loading, error, value } = useAsync(() => getPluginSettings(plugin, { showErrorAlert: false }));

  const installed = value && !error && !loading;
  const enabled = value?.enabled;
  const isLoading = loading && !value;

  if (isLoading) {
    return { loading: true };
  }

  if (!installed || !enabled) {
    return { loading: false, installed: false };
  }

  return { loading, installed: true, settings: value };
}

export function createBridgeURL(plugin: PluginID, path?: string, options?: Record<string, string>) {
  const searchParams = new URLSearchParams(options).toString();
  const pluginPath = `/a/${plugin}${path}`;

  return pluginPath + (searchParams ? '?' + searchParams : '');
}
