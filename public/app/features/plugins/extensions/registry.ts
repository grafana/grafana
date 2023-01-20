import { type PluginExtensions, type PluginExtensionsLink, type UrlQueryMap, urlUtil } from '@grafana/data';

type PluginExtensionsRegistryLink = {
  description: string;
  href: string;
};

type PluginExtensionsRegistry = {
  links: Record<string, PluginExtensionsRegistryLink>;
};

let registry: PluginExtensionsRegistry = {
  links: {},
};

export function getRegistry() {
  return registry;
}

function getRegistryLinks(pluginId: string, links: PluginExtensionsLink[]) {
  return links.reduce<Record<string, PluginExtensionsRegistryLink>>((registryLinks, linkExtension) => {
    const linkId = `${pluginId}.${linkExtension.id}`;

    if (registryLinks[linkId]) {
      return registryLinks;
    }

    registryLinks[linkId] = {
      description: linkExtension.description,
      href: `/a/${pluginId}${linkExtension.path}`,
    };
    return registryLinks;
  }, {});
}

export function configurePluginExtensions(pluginExtensions: Record<string, PluginExtensions>): void {
  registry = Object.entries(pluginExtensions).reduce<PluginExtensionsRegistry>(
    (registry, [pluginId, pluginExtension]) => {
      const links = getRegistryLinks(pluginId, pluginExtension.links);

      registry.links = { ...links, ...registry.links };
      return registry;
    },
    { links: {} }
  );

  Object.freeze(registry);
}

type PluginLinkOptions = {
  id: string;
  queryParams?: UrlQueryMap;
};

type PluginLinkResult = {
  href?: string;
  error?: Error;
  description?: string;
};

export class PluginLinkMissingError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Could not find link for '${id}'`);
    this.id = id;
    this.name = PluginLinkMissingError.name;
  }
}

export function getPluginLink({ id, queryParams }: PluginLinkOptions): PluginLinkResult {
  const extension = registry.links[id];

  if (!extension) {
    return {
      error: new PluginLinkMissingError(id),
    };
  }

  return {
    description: extension.description,
    href: urlUtil.renderUrl(extension.href, queryParams),
  };
}
