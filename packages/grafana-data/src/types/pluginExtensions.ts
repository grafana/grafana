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

export function extensionLinkConfigIsValid(props: {
  path?: string;
  description?: string;
  title?: string;
  placement?: string;
}) {
  const valuesAreStrings = Object.values(props).every((val) => typeof val === 'string' && val.length);
  const placementIsValid = props.placement?.startsWith('grafana/') || props.placement?.startsWith('plugins/');
  return valuesAreStrings && placementIsValid;
}
