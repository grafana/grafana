// @internal
export type PluginExtensions = {
  links: PluginExtensionsLink[];
};

// @internal
export type PluginExtensionsLink = {
  id: string;
  description: string;
  path: string;
};
