import {
  isPluginsExtensionLink,
  type PluginsExtension,
  type PluginsExtensionLink,
  type PluginsExtensionLinkOverride,
} from '@grafana/data';

import { getPluginsExtensionRegistry } from './registry';

export type PluginExtensionsOptions<T extends object> = {
  placement: string;
  context?: T;
};

export type PluginExtensionsResult = {
  extensions: PluginsExtension[];
};

export function getPluginExtensions<T extends object = {}>({
  placement,
  context,
}: PluginExtensionsOptions<T>): PluginExtensionsResult {
  const registry = getPluginsExtensionRegistry();
  const extensions = registry[placement] ?? [];

  return {
    extensions: configureExtensions(extensions, context),
  };
}

function configureExtensions<T extends object>(extensions: PluginsExtension[], context?: T): PluginsExtension[] {
  return extensions.reduce<PluginsExtension[]>((extensions, extension) => {
    const configured = configureExtension(extension, context);
    if (configured) {
      extensions.push(configured);
    }
    return extensions;
  }, []);
}

function configureExtension<T extends object>(extension: PluginsExtension, context?: T): PluginsExtension | undefined {
  if (isPluginsExtensionLink(extension)) {
    return configureLink(extension, context);
  }
  return;
}

function configureLink<T extends object>(link: PluginsExtensionLink, context?: T): PluginsExtensionLink | undefined {
  if (!link.configure) {
    return link;
  }

  // Only allow a plugin to access the overridable fields of the link extension
  const { title, description, path } = link;
  const overridable: PluginsExtensionLinkOverride = { title, description, path };
  const configured = link.configure(overridable, context);

  if (!configured) {
    return;
  }

  return {
    ...link,
    title: configured?.title ?? link.title,
    description: configured?.description ?? link.description,
    path: configured?.path ?? link.path,
  };
}
