import type { PluginsExtensionLink, PluginsExtensionLinkOverridable } from '@grafana/data';

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
    extensions: extensions.reduce<PluginsExtensionLink[]>((allExtensions, extension) => {
      if (!extension.override) {
        return [...allExtensions, extension];
      }
      // Only allow a plugin to access the overridable fields of the link extension
      const { title, description, path } = extension;
      const linkWithLimitedProps: PluginsExtensionLinkOverridable = { title, description, path };
      const overridenLink = extension.override(linkWithLimitedProps, context);

      // Skip the extension from being displayed
      if (overridenLink === null) {
        return allExtensions;
      }

      return [
        ...allExtensions,
        {
          ...extension,
          ...{
            title: overridenLink?.title || title,
            description: overridenLink?.description || description,
            path: overridenLink?.path || path,
          },
        },
      ];
    }, []),
  };
}
