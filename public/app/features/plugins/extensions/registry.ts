import {
  AppPluginConfig,
  PluginExtensionTypes,
  PluginsExtensionLinkConfig,
  PluginsExtensionRegistry,
  PluginsExtensionLink,
} from '@grafana/runtime';

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

      if (!Array.isArray(registry[placement])) {
        registry[placement] = [item];
        continue;
      }

      registry[placement].push(item);
      continue;
    }
  }

  for (const key of Object.keys(registry)) {
    Object.freeze(registry[key]);
  }

  return Object.freeze(registry);
}

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionLink {
  const path = `/a/${pluginId}${extension.path}`;

  return Object.freeze({
    type: PluginExtensionTypes.link,
    title: extension.title,
    description: extension.description,
    path: path,
    key: hashKey(`${extension.title}${path}`),
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}
