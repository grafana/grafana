import { getPluginsExtensionRegistry, PluginsExtension } from './registry';

export type GetPluginExtensionsOptions = {
  id: string;
};

export type PluginExtensionsResult = {
  extensions: PluginsExtension[];
  error?: Error;
};

export class PluginExtensionsMissingError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`Could not find extensions for '${id}'`);
    this.id = id;
    this.name = PluginExtensionsMissingError.name;
  }
}

export function getPluginExtensions({ id }: GetPluginExtensionsOptions): PluginExtensionsResult {
  const registry = getPluginsExtensionRegistry();
  const extensions = registry[id];

  if (!Array.isArray(extensions)) {
    return {
      extensions: [],
      error: new PluginExtensionsMissingError(id),
    };
  }

  return { extensions };
}
