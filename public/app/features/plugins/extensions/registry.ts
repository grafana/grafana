import type { PluginsExtensionConfig, PluginsExtensionLinkConfig } from '@grafana/data';
import type { PluginsExtensionRegistry, PluginsExtensionRegistryLink } from '@grafana/runtime';

export function configurePluginExtensions(
  pluginExtensions: Record<string, PluginsExtensionConfig>
): PluginsExtensionRegistry {
  const registry = Object.entries(pluginExtensions).reduce<PluginsExtensionRegistry>(
    (registry, [pluginId, pluginExtension]) => {
      const links = createLinks(pluginId, pluginExtension.links);
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
