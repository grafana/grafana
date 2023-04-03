import { PluginExtension, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';

export function isPluginExtensionLink(extension: PluginExtension | undefined): extension is PluginExtensionLink {
  if (!extension) {
    return false;
  }

  return extension.type === PluginExtensionTypes.link && 'path' in extension;
}
