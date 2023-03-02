import { type PluginExtension } from '@grafana/data';

import { getPluginsExtensionRegistry } from './registry';

export type PluginExtensionsOptions<T extends object> = {
  placement: string;
  context?: T;
};

export type PluginExtensionsResult = {
  extensions: PluginExtension[];
};

export function getPluginExtensions<T extends object = {}>(
  options: PluginExtensionsOptions<T>
): PluginExtensionsResult {
  const { placement, context } = options;
  const registry = getPluginsExtensionRegistry();
  const configureFuncs = registry[placement] ?? [];

  const extensions = configureFuncs.reduce<PluginExtension[]>((result, configure) => {
    const extension = configure(context);
    if (extension) {
      result.push(extension);
    }
    return result;
  }, []);

  return {
    extensions: extensions,
  };
}
