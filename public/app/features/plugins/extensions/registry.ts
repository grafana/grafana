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
      const target = extension.target;
      const item = createRegistryItem(pluginId, extension);

      if (!Array.isArray(registry[target])) {
        registry[target] = [item];
        continue;
      }

      registry[target].push(item);
      continue;
    }
  }

  for (const key of Object.keys(registry)) {
    Object.freeze(registry[key]);
  }

  return Object.freeze(registry);
}

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionLink {
  const href = `/a/${pluginId}${extension.path}`;

  return Object.freeze({
    type: PluginExtensionTypes.link,
    title: extension.title,
    description: extension.description,
    href: href,
    key: hashKey(`${extension.title}${href}`),
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}
