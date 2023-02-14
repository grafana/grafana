export type LinkExtensionConfigurer<T extends object = object> = (
  link: PluginsExtensionLinkOverride,
  context?: T
) => Partial<PluginsExtensionLinkOverride> | undefined;

export type PluginsExtensionLink = {
  type: 'link';
  title: string;
  description: string;
  path: string;
  key: number;
  configure?: LinkExtensionConfigurer;
};

export type PluginsExtensionLinkOverride = Pick<PluginsExtensionLink, 'title' | 'description' | 'path'>;
