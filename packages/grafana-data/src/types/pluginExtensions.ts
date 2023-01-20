// @internal
export type PluginsExtensionConfig = {
  links: PluginsExtensionLinkConfig[];
};

// @internal
export type PluginsExtensionLinkConfig = {
  id: string;
  description: string;
  path: string;
};
