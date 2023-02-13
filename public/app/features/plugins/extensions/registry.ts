import { PluginsExtensionLink } from '@grafana/data';
import {
  AppPluginConfig,
  PluginExtensionTypes,
  PluginsExtensionLinkConfig,
  PluginsExtensionRegistry,
} from '@grafana/runtime';

import { getPreloadPluginConfig } from '../pluginPreloadConfigs';

export function createPluginExtensionsRegistry(apps: Record<string, AppPluginConfig> = {}): PluginsExtensionRegistry {
  const registry: PluginsExtensionRegistry = {};
  for (const [pluginId, config] of Object.entries(apps)) {
    const extensions = config.extensions;

    if (!Array.isArray(extensions)) {
      continue;
    }

    const counter: Record<string, number> = {};

    for (const extension of extensions) {
      const placement = extension.placement;
      counter[placement] = (counter[placement] ?? 0) + 1;
      const item = createRegistryItem(pluginId, extension);

      // If there was an issue initialising the plugin, skip adding its extensions to the registry
      if (!item || counter[placement] > 3) {
        continue;
      }

      if (!Array.isArray(registry[placement])) {
        registry[placement] = [item];
        continue;
      }

      registry[placement].push(item);
    }
  }

  for (const key of Object.keys(registry)) {
    Object.freeze(registry[key]);
  }

  return Object.freeze(registry);
}

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionLink | undefined {
  const path = `/a/${pluginId}${extension.path}`;
  const config = getPreloadPluginConfig(pluginId);

  if (config?.error) {
    return;
  }

  return Object.freeze({
    type: PluginExtensionTypes.link,
    title: extension.title,
    description: extension.description,
    key: hashKey(`${extension.title}${path}`),
    path,
    configure: config?.extensionConfigs?.[extension.id],
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}
