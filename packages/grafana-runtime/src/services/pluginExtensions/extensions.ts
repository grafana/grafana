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
    extensions: extensions.reduce<PluginsExtensionLink[]>((all, e) => {
      if (!e.override) {
        return [...all, e];
      }
      // TODO: map into other object without all values.
      const overriden = e.override(e, context);
      if (overriden) {
        return [...all, { ...e, ...overriden }];
      }
      return all;
    }, []),
  };
}
