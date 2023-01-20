import { type PluginExtensions, type PluginExtensionsLink } from '@grafana/data';

function getRegistryLinks(pluginId: string, links: PluginExtensionsLink[]) {
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
  pluginExtensions: Record<string, PluginExtensions>
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
