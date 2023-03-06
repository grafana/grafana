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
  const items = registry[placement] ?? [];

  const extensions = items.reduce<PluginExtension[]>((result, item) => {
    if (!context || !item.configure) {
      result.push(item.extension);
      return result;
    }

    const extension = item.configure(context);
    if (extension) {
      result.push(extension);
    }
    return result;
  }, []);

  return {
    extensions: extensions,
  };
}
