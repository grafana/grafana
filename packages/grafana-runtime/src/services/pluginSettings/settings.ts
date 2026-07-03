import { PluginType } from '@grafana/data';

import { getPluginSettings } from './getPluginSettings';
import { logPluginSettingsError, logPluginSettingsWarning } from './logging';
import { isAuthError, isNotFoundError } from './utils';

export async function getAppPluginEnabled(pluginId: string): Promise<boolean> {
  if (!pluginId) {
    return false;
  }

  const app = await getPluginSettings(pluginId);
  if (!app) {
    return false;
  }

  return app.type === PluginType.app && Boolean(app.enabled);
}

/**
 * The state of an app plugin from the caller's perspective:
 * - `enabled`: the plugin is an installed, enabled app.
 * - `not-an-enabled-app`: the plugin is a non-app type, a disabled app, or not installed (404) — a
 *   definitive answer.
 * - `unknown`: the settings request failed for a transient/indeterminate reason (auth / server /
 *   network), so the state could not be determined.
 */
export type AppPluginEnabledState = 'enabled' | 'not-an-enabled-app' | 'unknown';

/**
 * Like {@link getAppPluginEnabled}, but distinguishes a definitive answer from an indeterminate one.
 * Callers that gate destructive actions on plugin ownership should treat `unknown` as still managed
 * rather than exposing those actions on a failed check.
 */
export async function getAppPluginEnabledState(pluginId: string): Promise<AppPluginEnabledState> {
  if (!pluginId) {
    return 'not-an-enabled-app';
  }

  try {
    const app = await getPluginSettings(pluginId);
    return app?.type === PluginType.app && Boolean(app.enabled) ? 'enabled' : 'not-an-enabled-app';
  } catch (error) {
    // getPluginSettings throws on a 404 (plugin not installed) as well as on transient failures
    // (auth / server / network). A 404 is a definitive "not an installed app"; anything else means
    // we could not determine the state.
    if (isNotFoundError(error)) {
      return 'not-an-enabled-app';
    }
    // Surface the indeterminate failure so a persistently failing check is visible, then report it
    // as 'unknown' so callers keep treating the rule as managed rather than exposing it.
    if (isAuthError(error)) {
      logPluginSettingsWarning('getAppPluginEnabledState: could not determine plugin state, auth denied', {
        pluginId,
      });
    } else {
      logPluginSettingsError('getAppPluginEnabledState: could not determine plugin state', error, { pluginId });
    }
    return 'unknown';
  }
}

/**
 * Check if an app plugin is installed and enabled.
 * @param pluginId - The id of the app plugin.
 * @returns True if the app plugin is installed and enabled, false otherwise.
 */
export async function isAppPluginEnabled(pluginId: string): Promise<boolean> {
  try {
    const enabled = await getAppPluginEnabled(pluginId);
    return enabled;
  } catch (error) {
    if (isAuthError(error)) {
      logPluginSettingsWarning(`isAppPluginEnabled: failed because auth denied`, { pluginId });
    } else {
      logPluginSettingsError(`isAppPluginEnabled: failed because of unknown reason`, error, { pluginId });
    }
  }
  return false;
}
