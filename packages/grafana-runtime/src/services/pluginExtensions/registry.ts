export type PluginsExtensionLink = {
  type: 'link';
  title: string;
  description: string;
  href: string;
  key: number;
};

export type PluginsExtension = PluginsExtensionLink;

export type PluginsExtensionRegistry = Record<string, PluginsExtension[]>;

let registry: PluginsExtensionRegistry | undefined;

export function setPluginsExtensionRegistry(instance: PluginsExtensionRegistry): void {
  if (registry) {
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
