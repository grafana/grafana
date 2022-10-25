import React, { FC } from 'react';
import { useAsync } from 'react-use';

import { getPluginSettings } from 'app/features/plugins/pluginSettings';

export interface PluginBridgeProps {
  plugin: SupportedPlugin;
}

export enum SupportedPlugin {
  Incident = 'grafana-incident-app',
  OnCall = 'grafana-oncall-app',
  MachineLearning = 'grafana-ml-app',
}

export const PluginBridge: FC<PluginBridgeProps> = ({ children, plugin }) => {
  const { loading, error } = useAsync(() => getPluginSettings(plugin, { showErrorAlert: false }));

  // don't show anything while loading
  // TODO show the content but disabled? Maybe we want "ifLoading" and "ifExists" and "idDoesNotExist" as interface?
  if (loading || error) {
    return null;
  }

  return <>{children}</>;
};

// TODO use Record<string, URLSafeType>
export function createBridgeURL(plugin: SupportedPlugin, path?: string, options?: Record<string, string>) {
  const searchParams = new URLSearchParams(options).toString();
  const pluginPath = `/a/${plugin}${path}`;

  return pluginPath + (searchParams ? '?' + searchParams : '');
}
