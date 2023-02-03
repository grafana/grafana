import { getPluginsExtensionRegistry, PluginsExtensionRegistryLink } from './registry';

export type PluginLinksOptions = {
  target: string;
};

export type PluginLinksResult = {
  extensions: PluginsExtensionRegistryLink[];
  error?: Error;
};

export class PluginLinkExtensionsMissingError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Could not find link for '${id}'`);
    this.id = id;
    this.name = PluginLinkExtensionsMissingError.name;
  }
}

export function getPluginExtensions({ target }: PluginLinksOptions): PluginLinksResult {
  const registry = getPluginsExtensionRegistry();
  const extensions = registry[target];

  if (!Array.isArray(extensions)) {
    return {
      extensions: [],
      error: new PluginLinkExtensionsMissingError(target),
    };
  }

  return { extensions };
}
