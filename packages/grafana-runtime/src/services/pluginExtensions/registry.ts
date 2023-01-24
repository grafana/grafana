export type PluginsExtensionRegistryLink = {
  description: string;
  href: string;
};

export type PluginsExtensionRegistry = {
  links: Record<string, PluginsExtensionRegistryLink>;
};

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
