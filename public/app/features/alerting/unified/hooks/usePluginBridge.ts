import { OrgRole, type PluginMeta } from '@grafana/data';
import { usePluginSettings } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { type PluginID } from '../components/PluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';

interface PluginBridgeHookResponse {
  loading: boolean;
  installed?: boolean;
  error?: Error;
  settings?: PluginMeta<{}>;
}

export function usePluginBridge(plugin: PluginID): PluginBridgeHookResponse {
  const { value, loading, error } = usePluginSettings(plugin);

  if (loading) {
    return { loading: true };
  }

  if (error) {
    return { loading: false, error: error instanceof Error ? error : new Error(String(error)) };
  }

  if (value) {
    return { loading: false, installed: value.enabled ?? false, settings: value };
  }

  return { loading: false, installed: false };
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
 * Checks access to a specific plugin page path using the same include role/action
 * semantics as the core app plugin route guard.
 */
export function canAccessPluginPage(settings: PluginMeta<{}>, pluginPagePath: string): boolean {
  const requestedPath = pluginPagePath.split('?')[0];
  const pluginInclude = settings.includes?.find((include) => include.path === requestedPath);

  if (!pluginInclude) {
    return true;
  }

  if (pluginInclude.action) {
    return contextSrv.hasPermission(pluginInclude.action);
  }

  if (contextSrv.isGrafanaAdmin || contextSrv.user.orgRole === OrgRole.Admin) {
    return true;
  }

  const includeRole = pluginInclude.role ?? '';
  if (!includeRole || (contextSrv.isEditor && includeRole === OrgRole.Viewer)) {
    return true;
  }

  return contextSrv.hasRole(includeRole);
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
