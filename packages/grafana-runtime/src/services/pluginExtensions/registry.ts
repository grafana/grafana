export type PluginExtensionsRegistryLink = {
  description: string;
  href: string;
};

export type PluginExtensionsRegistry = {
  links: Record<string, PluginExtensionsRegistryLink>;
};

let registry: PluginExtensionsRegistry | undefined;

export function setExtensionsRegistry(instance: PluginExtensionsRegistry): void {
  if (registry) {
    throw new Error('setExtensionsRegistry function should only be set once, when Grafana is starting.');
  }
  registry = instance;
}

export function getExtensionsRegistry(): PluginExtensionsRegistry {
  if (!registry) {
    throw new Error('getExtensionsRegistry can only be used after Grafana instance has started.');
  }
  return registry;
}
