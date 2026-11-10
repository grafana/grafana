import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { assertPluginId } from '../assertPluginId';
import { getApiVersion } from '../pluginUtils';

import { logPluginMetaError } from './logging';

export async function uninstallPluginMeta(pluginId: string): Promise<void> {
  await assertPluginId(pluginId);

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return;
  }

  const result = await fetch(
    `apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins/${pluginId}`,
    {
      method: 'DELETE',
    }
  );

  if (!result.ok) {
    const error = new Error(`Failed to uninstall plugin ${pluginId} ${result.status}:${result.statusText}`);
    logPluginMetaError('PluginMeta: failed to uninstall plugin', error, {
      pluginId,
      status: String(result.status),
      statusText: result.statusText,
    });
    throw error;
  }
}
