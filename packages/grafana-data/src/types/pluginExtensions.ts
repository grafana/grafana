/**
 * These types are exposed when rendering extension points
 */

export enum PluginExtensionTypes {
  link = 'link',
}

export type PluginExtension = {
  type: PluginExtensionTypes;
  title: string;
  description: string;
  key: number;
};

export type PluginExtensionLink = PluginExtension & {
  type: PluginExtensionTypes.link;
  path: string;
};

export function isPluginExtensionLink(extension: PluginExtension): extension is PluginExtensionLink {
  return extension.type === PluginExtensionTypes.link && 'path' in extension;
}
