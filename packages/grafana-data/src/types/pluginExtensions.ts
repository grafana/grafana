export enum PluginsExtensionTypes {
  link = 'link',
}

export type PluginsExtensionLinkConfigurer<T extends object = object> = (
  link: PluginsExtensionLinkOverride,
  context?: T
) => Partial<PluginsExtensionLinkOverride> | undefined;

export type PluginsExtensionLink = {
  type: PluginsExtensionTypes.link;
  title: string;
  description: string;
  path: string;
  key: number;
  configure?: PluginsExtensionLinkConfigurer;
};

export type PluginsExtensionLinkOverride = Pick<PluginsExtensionLink, 'title' | 'description' | 'path'>;

export type PluginsExtension = PluginsExtensionLink;

export function isPluginsExtensionLink(extension: PluginsExtension): extension is PluginsExtensionLink {
  return extension.type === PluginsExtensionTypes.link;
}
