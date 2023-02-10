import { PluginsExtensionLink } from '@grafana/data';
import {
  AppPluginConfig,
  PluginExtensionTypes,
  PluginsExtensionLinkConfig,
  PluginsExtensionRegistry,
} from '@grafana/runtime';

import { getPluginLoadedConfig } from '../pluginPreloader';

export function createPluginExtensionsRegistry(apps: Record<string, AppPluginConfig> = {}): PluginsExtensionRegistry {
  const registry: PluginsExtensionRegistry = {};
  for (const [pluginId, config] of Object.entries(apps)) {
    const extensions = config.extensions;

    if (!Array.isArray(extensions)) {
      continue;
    }

    for (const extension of extensions) {
      const placement = extension.placement;
      const item = createRegistryItem(pluginId, extension);

      // If there was an issue initialising the plugin, skip adding its extensions to the registry
      if (!item) {
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

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionLink | null {
  const path = `/a/${pluginId}${extension.path}`;
  const { hasLoaded, extensionOverrides } = getPluginLoadedConfig(pluginId);

  if (!hasLoaded) {
    return null;
  }

  return Object.freeze({
    id: extension.id,
    pluginId,
    type: PluginExtensionTypes.link,
    title: extension.title,
    description: extension.description,
    key: hashKey(`${extension.title}${path}`),
    path,
    override: extensionOverrides?.[extension.id],
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}
