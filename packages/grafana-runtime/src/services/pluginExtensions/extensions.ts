import { PluginsExtensionLink } from '@grafana/data';

import { getPluginsExtensionRegistry, PluginsExtension } from './registry';

export type GetPluginExtensionsOptions<T extends object> = {
  placement: string;
  context?: T;
};

export type PluginExtensionsResult = {
  extensions: PluginsExtension[];
  error?: Error;
};

export class PluginExtensionsMissingError extends Error {
  readonly placement: string;

  constructor(placement: string) {
    super(`Could not find extensions for '${placement}'`);
    this.placement = placement;
    this.name = PluginExtensionsMissingError.name;
  }
}

export function getPluginExtensions<T extends object = {}>({
  placement,
  context,
}: GetPluginExtensionsOptions<T>): PluginExtensionsResult {
  const registry = getPluginsExtensionRegistry();
  const extensions = registry[placement];

  if (!Array.isArray(extensions)) {
    return {
      extensions: [],
      error: new PluginExtensionsMissingError(placement),
    };
  }

  return {
    extensions: extensions.reduce<PluginsExtensionLink[]>((all, extension) => {
      if (!extension.override) {
        return [...all, extension];
      }
      // Only give a plugin dev the parts of the link that they need to override
      const { override, id, pluginId, type, ...overrideLink } = extension;
      const overriden = extension.override(overrideLink, context);
      if (overriden) {
        return [...all, { ...extension, ...overriden }];
      }
      return all;
    }, []),
  };
}
