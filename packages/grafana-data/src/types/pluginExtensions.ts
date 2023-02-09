export type PluginsExtensionLink = {
  type: 'link';
  title: string;
  description: string;
  path: string;
  key: number;
};

export type PluginsExtensionLinkOverridable = Pick<PluginsExtensionLink, 'title' | 'description' | 'path'>;
