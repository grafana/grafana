import { PluginExtension } from '@grafana/data';

export type PluginExtensionRegistryItem<T extends PluginExtension = PluginExtension, C extends object = object> = (
  context?: C
) => T | undefined;

export type PluginExtensionRegistry = Record<string, PluginExtensionRegistryItem[]>;

let registry: PluginExtensionRegistry | undefined;

export function setPluginsExtensionRegistry(instance: PluginExtensionRegistry): void {
  if (registry && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginsExtensionRegistry function should only be called once, when Grafana is starting.');
  }
  registry = instance;
}

export function getPluginsExtensionRegistry(): PluginExtensionRegistry {
  if (!registry) {
    throw new Error('getPluginsExtensionRegistry can only be used after the Grafana instance has started.');
  }
  return registry;
}
