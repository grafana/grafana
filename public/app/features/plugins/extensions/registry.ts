import type {
  AppPluginConfig,
  PluginsExtensionLinkConfig,
  PluginsExtensionRegistry,
  PluginsExtensionRegistryLink,
} from '@grafana/runtime';

export function createPluginExtensionsRegistry(apps: Record<string, AppPluginConfig> = {}): PluginsExtensionRegistry {
  const registry = Object.entries(apps).reduce<PluginsExtensionRegistry>(
    (registry, [pluginId, config]) => {
      const extensions = config.extensions;
      if (!extensions) {
        return registry;
      }
      const links = createLinks(pluginId, extensions.links);
      registry.links = { ...links, ...registry.links };

      return registry;
    },
    { links: {} }
  );

  return Object.freeze(registry);
}

function createLinks(pluginId: string, links: PluginsExtensionLinkConfig[]) {
  return Object.freeze(
    links.reduce<Record<string, PluginsExtensionRegistryLink>>((registryLinks, linkExtension) => {
      const linkId = `${pluginId}.${linkExtension.id}`;

      if (registryLinks[linkId]) {
        return registryLinks;
      }

      registryLinks[linkId] = Object.freeze({
        description: linkExtension.description,
        href: `/a/${pluginId}${linkExtension.path}`,
      });
      return registryLinks;
    }, {})
  );
}
