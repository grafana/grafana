import type { PluginExtensionsConfig, PluginExtensionsLinkConfig } from '@grafana/data';
import type { PluginExtensionsRegistry, PluginExtensionsRegistryLink } from '@grafana/runtime';

function getRegistryLinks(pluginId: string, links: PluginExtensionsLinkConfig[]) {
  return Object.freeze(
    links.reduce<Record<string, PluginExtensionsRegistryLink>>((registryLinks, linkExtension) => {
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

export function configurePluginExtensions(
  pluginExtensions: Record<string, PluginExtensionsConfig>
): PluginExtensionsRegistry {
  const registry = Object.entries(pluginExtensions).reduce<PluginExtensionsRegistry>(
    (registry, [pluginId, pluginExtension]) => {
      const links = getRegistryLinks(pluginId, pluginExtension.links);

      registry.links = { ...links, ...registry.links };
      return registry;
    },
    { links: {} }
  );

  Object.freeze(registry);
  return registry;
}
