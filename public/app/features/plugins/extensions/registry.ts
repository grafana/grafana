import type {
  AppPluginConfig,
  PluginsExtensionLinkConfig,
  PluginsExtensionRegistry,
  PluginsExtensionRegistryLink,
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

  return Object.freeze(registry);
}

function createRegistryItem(pluginId: string, extension: PluginsExtensionLinkConfig): PluginsExtensionRegistryLink {
  return Object.freeze({
    title: extension.title,
    description: extension.description,
    href: `/a/${pluginId}${extension.path}`,
  });
}
