// @internal
export type PluginExtensionsConfig = {
  links: PluginExtensionsLinkConfig[];
};

// @internal
export type PluginExtensionsLinkConfig = {
  id: string;
  description: string;
  path: string;
};
