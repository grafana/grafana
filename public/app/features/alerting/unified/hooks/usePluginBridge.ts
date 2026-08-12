import { useAsync } from 'react-use';

import { OrgRole, type PluginMeta } from '@grafana/data';
import { isAppPluginInstalled, isFetchError } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { type PluginID } from '../components/PluginBridge';
import { SupportedPlugin } from '../types/pluginBridges';

interface PluginBridgeHookResponse {
  loading: boolean;
  installed?: boolean;
  error?: Error;
  settings?: PluginMeta<{}>;
}

/**
 * A settled probe is always a defined object, so `value === undefined` unambiguously means
 * "still resolving" and can never be confused with "settled, but nothing found".
 */
interface BridgeProbe {
  settings?: PluginMeta<{}>;
}

/**
 * Every plugin used with a bridge is an *app* plugin — createBridgeURL deep-links to `/a/<id>`,
 * which only exists for apps. So we can check bootdata (free, no request) for whether the app is
 * installed at all before asking the backend for its settings. Without this gate, checking for an
 * app that isn't installed 404s on every mount: the rejection evicts the promise from the settings
 * cache instead of being deduped for the session, and gets reported as an error to telemetry.
 */
export async function probePlugin(plugin: PluginID): Promise<BridgeProbe> {
  if (!plugin || !(await isAppPluginInstalled(plugin))) {
    return {};
  }

  try {
    return { settings: await getPluginSettings(plugin) };
  } catch (error) {
    // getLegacySettings wraps the raw fetch error as the `cause`. A 404 means the plugin is
    // not installed after all — treat it as a normal absence, not an error.
    const cause = error instanceof Error ? error.cause : error;
    if (isFetchError(cause) && cause.status === 404) {
      return {};
    }
    throw error;
  }
}

export function isPluginEnabled(settings?: PluginMeta<{}>): boolean {
  return settings?.enabled ?? false;
}

function toBridgeResponse(probe: BridgeProbe | undefined, error: unknown): PluginBridgeHookResponse {
  if (error) {
    return { loading: false, error: error instanceof Error ? error : new Error(String(error)) };
  }

  // An undefined probe means the request is still in flight. We deliberately don't look at
  // useAsync's `loading`: it is flipped in an effect, so the render right after the dependencies
  // change still reports the *previous* run as settled.
  if (!probe) {
    return { loading: true };
  }

  return { loading: false, installed: isPluginEnabled(probe.settings), settings: probe.settings };
}

export function usePluginBridge(plugin: PluginID): PluginBridgeHookResponse {
  const { value, error } = useAsync(() => probePlugin(plugin), [plugin]);
  return toBridgeResponse(value, error);
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
  const { value, error } = useAsync(async (): Promise<BridgeProbe & { pluginId: IrmWithFallback }> => {
    // Probing the legacy app only after IRM has come back unavailable means stacks that migrated
    // to IRM never touch OnCall / Incident at all. An IRM failure is not surfaced — it just means
    // we can't tell, so we ask the legacy app instead.
    const irmProbeResult = await probePlugin(SupportedPlugin.Irm).catch(() => {});
    if (isPluginEnabled(irmProbeResult?.settings)) {
      return { pluginId: SupportedPlugin.Irm, ...irmProbeResult };
    }

    const probeResult = await probePlugin(fallback);

    return { pluginId: fallback, ...probeResult };
  }, [fallback]);

  // While loading we don't know which plugin will win, so report the fallback — the same id the
  // caller would have seen before IRM existed.
  return { pluginId: value?.pluginId ?? fallback, ...toBridgeResponse(value, error) };
}
