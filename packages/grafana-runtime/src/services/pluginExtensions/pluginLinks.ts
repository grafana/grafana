import { UrlQueryMap, urlUtil } from '@grafana/data';

import { getExtensionsRegistry } from './registry';

export type PluginLinkOptions = {
  id: string;
  queryParams?: UrlQueryMap;
};

export type PluginLinkResult = {
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
  const registry = getExtensionsRegistry();
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
