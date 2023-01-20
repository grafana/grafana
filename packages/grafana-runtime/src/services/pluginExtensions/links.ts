import { UrlQueryMap, urlUtil } from '@grafana/data';

import { getPluginsExtensionRegistry } from './registry';

export type PluginLinkOptions = {
  id: string;
  queryParams?: UrlQueryMap;
};

export type PluginLinkResult = {
  link?: PluginLink;
  error?: Error;
};

export type PluginLink = {
  href: string;
  description: string;
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
  const registry = getPluginsExtensionRegistry();
  const extension = registry.links[id];

  if (!extension) {
    return {
      error: new PluginLinkMissingError(id),
    };
  }

  return {
    link: {
      description: extension.description,
      href: urlUtil.renderUrl(extension.href, queryParams),
    },
  };
}
