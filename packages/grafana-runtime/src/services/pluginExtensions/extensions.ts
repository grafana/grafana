import { config } from 'src/config';

import { type PluginExtension } from '@grafana/data';

import { getPluginsExtensionRegistry } from './registry';

export type PluginExtensionsOptions<T extends object> = {
  placement: string;
  context?: T;
  createMocks?: () => PluginExtension[];
};

export type PluginExtensionsResult = {
  extensions: PluginExtension[];
};

export function getPluginExtensions<T extends object = {}>(
  options: PluginExtensionsOptions<T>
): PluginExtensionsResult {
  const { placement, context, createMocks } = options;
  const registry = getPluginsExtensionRegistry();
  const configureFuncs = registry[placement] ?? [];

  if (config.pluginExtensionMockedPoints.find((p) => p === placement)) {
    return {
      extensions: createMocks?.() ?? [],
    };
  }

  const extensions = configureFuncs.reduce<PluginExtension[]>((result, configure) => {
    const extension = configure(context);

    // If the configure() function returns `undefined`, the extension is not displayed
    if (extension) {
      result.push(extension);
    }

    return result;
  }, []);

  return {
    extensions: extensions,
  };
}
