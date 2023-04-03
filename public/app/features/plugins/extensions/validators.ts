import type { PluginExtension, PluginExtensionLink, PluginExtensionLinkConfig } from '@grafana/data';
import { isPluginExtensionLink } from '@grafana/runtime';

import { isPluginExtensionLinkConfig, logWarning } from './utils';

export function assertPluginExtensionLink(
  extension: PluginExtension | undefined,
  errorMessage = 'extension is not a link extension'
): asserts extension is PluginExtensionLink {
  if (!isPluginExtensionLink(extension)) {
    throw new Error(errorMessage);
  }
}

export function assertPluginExtensionLinkConfig(
  extension: PluginExtensionLinkConfig,
  errorMessage = 'extension is not a command extension config'
): asserts extension is PluginExtensionLinkConfig {
  if (!isPluginExtensionLinkConfig(extension)) {
    throw new Error(errorMessage);
  }
}

export function assertLinkPathIsValid(pluginId: string, path: string) {
  if (!isLinkPathValid(pluginId, path)) {
    throw new Error(
      `Invalid link extension. The "path" is required and should start with "/a/${pluginId}/" (currently: "${path}"). Skipping the extension.`
    );
  }
}

export function assertPlacementIsValid(extension: PluginExtensionLinkConfig) {
  if (!isPlacementValid(extension)) {
    throw new Error(
      `Invalid extension "${extension.title}". The placement should start with either "grafana/" or "plugins/" (currently: "${extension.placement}"). Skipping the extension.`
    );
  }
}

export function assertConfigureIsValid(extension: PluginExtensionLinkConfig) {
  if (!isConfigureFnValid(extension)) {
    throw new Error(
      `Invalid extension "${extension.title}". The "configure" property must be a function. Skipping the extension.`
    );
  }
}

export function assertStringProps(extension: Record<string, unknown>, props: string[]) {
  for (const prop of props) {
    if (!isStringPropValid(extension[prop])) {
      throw new Error(
        `Invalid extension "${extension.title}". Property "${prop}" must be a string and cannot be empty. Skipping the extension.`
      );
    }
  }
}

export function assertIsNotPromise(value: unknown, errorMessage = 'The provided value is a Promise.'): void {
  if (isPromise(value)) {
    throw new Error(errorMessage);
  }
}

export function isLinkPathValid(pluginId: string, path: string) {
  return Boolean(typeof path === 'string' && path.length > 0 && path.startsWith(`/a/${pluginId}/`));
}

export function isPlacementValid(extension: PluginExtensionLinkConfig) {
  return Boolean(extension.placement?.startsWith('grafana/') || extension.placement?.startsWith('plugins/'));
}

export function isConfigureFnValid(extension: PluginExtensionLinkConfig) {
  return extension.configure ? typeof extension.configure === 'function' : true;
}

export function isStringPropValid(prop: unknown) {
  return typeof prop === 'string' && prop.length > 0;
}

export function isPluginExtensionConfigValid(pluginId: string, extension: PluginExtensionLinkConfig): boolean {
  try {
    assertStringProps(extension, ['title', 'description', 'placement']);
    assertPlacementIsValid(extension);
    assertConfigureIsValid(extension);

    if (isPluginExtensionLinkConfig(extension)) {
      if (!extension.path && !extension.onClick) {
        logWarning(`Invalid extension "${extension.title}". Either "path" or "onClick" is required.`);
        return false;
      }

      if (extension.path) {
        assertLinkPathIsValid(pluginId, extension.path);
      }
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      logWarning(error.message);
    }

    return false;
  }
}

export function isPromise(value: unknown) {
  return value instanceof Promise || (typeof value === 'object' && value !== null && 'then' in value);
}
