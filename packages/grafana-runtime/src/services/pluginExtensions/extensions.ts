import { getPluginsExtensionRegistry, PluginsExtension } from './registry';

export type GetPluginExtensionsOptions = {
  target: string;
};

export type PluginExtensionsResult = {
  extensions: PluginsExtension[];
  error?: Error;
};

export class PluginExtensionsMissingError extends Error {
  readonly target: string;

  constructor(target: string) {
    super(`Could not find extensions for '${target}'`);
    this.target = target;
    this.name = PluginExtensionsMissingError.name;
  }
}

export function getPluginExtensions({ target }: GetPluginExtensionsOptions): PluginExtensionsResult {
  const registry = getPluginsExtensionRegistry();
  const extensions = registry[target];

  if (!Array.isArray(extensions)) {
    return {
      extensions: [],
      error: new PluginExtensionsMissingError(target),
    };
  }

  return { extensions };
}
