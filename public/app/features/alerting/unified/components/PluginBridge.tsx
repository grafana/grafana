import React, { ReactElement } from 'react';

import { usePluginBridge } from '../hooks/usePluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';

export type PluginID = SupportedPlugin | string;

export interface PluginBridgeProps {
  plugin: PluginID;
  // shows an optional component when the plugin is not installed
  notInstalledFallback?: ReactElement;
  // shows an optional component when we're checking if the plugin is installed
  loadingComponent?: ReactElement;
}

export const PluginBridge = ({
  children,
  plugin,
  loadingComponent,
  notInstalledFallback,
}: React.PropsWithChildren<PluginBridgeProps>) => {
  const { loading, installed } = usePluginBridge(plugin);

  if (loading) {
    return loadingComponent ?? null;
  }

  if (!installed) {
    return notInstalledFallback ?? null;
  }

  return <>{children}</>;
};

export function createBridgeURL(plugin: PluginID, path?: string, options?: Record<string, string>) {
  const searchParams = new URLSearchParams(options).toString();
  const pluginPath = `/a/${plugin}${path}`;

  return pluginPath + (searchParams ? '?' + searchParams : '');
}
