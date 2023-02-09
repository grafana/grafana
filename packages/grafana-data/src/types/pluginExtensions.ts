export type LinkExtensionCallback<T extends object = object> = (
  link: PluginsExtensionLinkOverridable,
  context?: T
) => PluginsExtensionLinkOverridable | undefined;

export type PluginsExtensionLink = {
  id: string;
  pluginId: string;
  type: 'link';
  title: string;
  description: string;
  path: string;
  key: number;
  override?: LinkExtensionCallback;
};

export type PluginsExtensionLinkOverridable = Pick<PluginsExtensionLink, 'title' | 'description' | 'path'>;
