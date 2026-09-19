import { type PluginMeta } from '@grafana/data';
import { isAppPluginInstalled, isFetchError } from '@grafana/runtime';
import { getPluginSettings } from '@grafana/runtime/unstable';

import { type PluginID } from '../components/PluginBridge';

export interface BridgeProbe {
  settings?: PluginMeta<{}>;
}

/**
 * Every plugin used with a bridge is an app plugin. Check boot data before asking the backend for
 * settings so an app that is not installed does not cause a request and a reported 404.
 */
export async function probePlugin(plugin: PluginID): Promise<BridgeProbe> {
  if (!plugin || !(await isAppPluginInstalled(plugin))) {
    return {};
  }

  try {
    return { settings: await getPluginSettings(plugin) };
  } catch (error) {
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
