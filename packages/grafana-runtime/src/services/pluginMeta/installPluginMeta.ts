import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { assertPluginId } from '../assertPluginId';
import { getApiVersion } from '../pluginUtils';

import { logPluginMetaError } from './logging';
import { type Plugin } from './types/plugin/plugin_object_gen';
import { defaultSpec } from './types/plugin/types.spec.gen';

export async function installPluginMeta(pluginId: string, version: string): Promise<void> {
  await assertPluginId(pluginId);

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)) {
    return;
  }

  const spec = { ...defaultSpec(), id: pluginId, version };
  const metadata = { name: pluginId, namespace: config.namespace };
  const data: Plugin = {
    apiVersion: `plugins.grafana.app/${getApiVersion()}`,
    kind: 'Plugin',
    metadata,
    spec,
    status: {},
  };

  const result = await fetch(`apis/plugins.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/plugins`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
  });

  if (!result.ok) {
    const error = new Error(`Failed to install plugin ${pluginId} ${result.status}:${result.statusText}`);
    logPluginMetaError('PluginMeta: failed to install plugin', error, {
      pluginId,
      status: String(result.status),
      statusText: result.statusText,
    });
    throw error;
  }
}
