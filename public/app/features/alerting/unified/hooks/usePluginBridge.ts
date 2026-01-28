import { PluginMeta } from '@grafana/data';

import { useGetPluginSettingsQuery } from '../api/pluginsApi';
import { PluginID } from '../components/PluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';

interface PluginBridgeHookResponse {
  loading: boolean;
  installed?: boolean;
  error?: Error;
  settings?: PluginMeta<{}>;
}

export function usePluginBridge(plugin: PluginID): PluginBridgeHookResponse {
  const { data, isLoading, error } = useGetPluginSettingsQuery(plugin);

  if (isLoading) {
    return { loading: true };
  }

  if (error) {
    return { loading: isLoading, error: error instanceof Error ? error : new Error(String(error)) };
  }

  if (data) {
    return { loading: isLoading, installed: data.enabled ?? false, settings: data };
  }

  return { loading: isLoading, installed: false };
}

type FallbackPlugin = SupportedPlugin.OnCall | SupportedPlugin.Incident;
type IrmWithFallback = SupportedPlugin.Irm | FallbackPlugin;

export interface PluginBridgeResult {
  pluginId: IrmWithFallback;
  loading: boolean;
  installed?: boolean;
  error?: Error;
  settings?: PluginMeta<{}>;
}
/**
 * Hook that checks for IRM plugin first, falls back to specified plugin.
 * IRM replaced both OnCall and Incident - this provides backward compatibility.
 *
 * @param fallback - The plugin to use if IRM is not installed (OnCall or Incident)
 * @returns Bridge result with the active plugin data
 *
 * @example
 * const { pluginId, loading, installed, settings } = useIrmPlugin(SupportedPlugin.OnCall);
 */
export function useIrmPlugin(fallback: FallbackPlugin): PluginBridgeResult {
  const irmBridge = usePluginBridge(SupportedPlugin.Irm);
  const fallbackBridge = usePluginBridge(fallback);

  const loading = irmBridge.loading || fallbackBridge.loading;
  const pluginId = irmBridge.installed ? SupportedPlugin.Irm : fallback;
  const activeBridge = irmBridge.installed ? irmBridge : fallbackBridge;

  return {
    pluginId,
    loading,
    installed: activeBridge.installed,
    error: activeBridge.error,
    settings: activeBridge.settings,
  };
}
