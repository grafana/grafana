import type { PluginsExtensionLink } from '@grafana/data';

export type PluginsExtension = PluginsExtensionLink;

export type PluginsExtensionRegistry = Record<string, PluginsExtension[]>;

let registry: PluginsExtensionRegistry | undefined;

export function setPluginsExtensionRegistry(instance: PluginsExtensionRegistry): void {
  if (registry && process.env.NODE_ENV !== 'test') {
    throw new Error('setPluginsExtensionRegistry function should only be called once, when Grafana is starting.');
  }
  registry = instance;
}

export function getPluginsExtensionRegistry(): PluginsExtensionRegistry {
  if (!registry) {
    throw new Error('getPluginsExtensionRegistry can only be used after the Grafana instance has started.');
  }
  return registry;
}
