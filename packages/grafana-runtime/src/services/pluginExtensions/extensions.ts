import type { PluginsExtensionLink, PluginsExtensionLinkOverride } from '@grafana/data';

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

  const configured = extensions.reduce<PluginsExtensionLink[]>((extensions, extension) => {
    const configured = configureLink(extension, context);
    if (configured) {
      extensions.push(configured);
    }
    return extensions;
  }, []);

  return {
    extensions: configured,
  };
}

function configureLink<T extends object>(link: PluginsExtensionLink, context?: T): PluginsExtensionLink | undefined {
  if (!link.configure) {
    return link;
  }

  // Only allow a plugin to access the overridable fields of the link extension
  const { title, description, path } = link;
  const overridable: PluginsExtensionLinkOverride = { title, description, path };
  const configured = link.configure(overridable, context);

  return {
    ...link,
    title: configured?.title ?? link.title,
    description: configured?.description ?? link.description,
    path: configured?.path ?? link.path,
  };
}
