// @internal
export type PluginExtensions = {
  links: Record<string, PluginExtensionsLink>;
};

// @internal
export type PluginExtensionsLink = {
  id: string;
  description: string;
  path: string;
};
