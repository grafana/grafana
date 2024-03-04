import {
  type PluginExtension,
  type PluginExtensionComponent,
  type PluginExtensionLink,
  PluginExtensionTypes,
  PluginExtensionFunction,
} from '@grafana/data';

export function isPluginExtensionLink(extension: PluginExtension | undefined): extension is PluginExtensionLink {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.link && ('path' in extension || 'onClick' in extension);
}

export function isPluginExtensionComponent(
  extension: PluginExtension | undefined
): extension is PluginExtensionComponent {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.component && 'component' in extension;
}

export function isPluginExtensionFunction(
  extension: PluginExtension | undefined
): extension is PluginExtensionFunction {
  if (!extension) {
    return false;
  }
  return extension.type === PluginExtensionTypes.function && 'function' in extension;
}
