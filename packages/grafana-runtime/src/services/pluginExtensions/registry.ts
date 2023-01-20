export type PluginExtensionsRegistryLink = {
  description: string;
  href: string;
};

export type PluginExtensionsRegistry = {
  links: Record<string, PluginExtensionsRegistryLink>;
};

let registry: PluginExtensionsRegistry = {
  links: {},
};

export function setExtensionsRegistry(instance: PluginExtensionsRegistry): void {
  registry = instance;
}

export function getExtensionsRegistry(): PluginExtensionsRegistry {
  return registry;
}
