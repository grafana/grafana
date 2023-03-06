import {
  AppConfigureExtension,
  AppPluginExtensionLink,
  AppPluginExtensionLinkConfig,
  PluginExtensionLink,
  PluginExtensionTypes,
} from '@grafana/data';
import type {
  PluginExtensionRegistry,
  PluginExtensionRegistryItem,
  RegistryConfigureExtension,
} from '@grafana/runtime';

import { PluginPreloadResult } from '../pluginPreloader';

import { createErrorHandling } from './errorHandling';
import { createLinkValidator, isValidLinkPath } from './validateLink';

export function createPluginExtensionRegistry(preloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};

  for (const result of preloadResults) {
    const pluginPlacementCount: Record<string, number> = {};
    const { pluginId, linkExtensions, error } = result;

    if (!Array.isArray(linkExtensions) || error) {
      continue;
    }

    for (const extension of linkExtensions) {
      const placement = extension.placement;

      pluginPlacementCount[placement] = (pluginPlacementCount[placement] ?? 0) + 1;
      const item = createRegistryLink(pluginId, extension);

      // If there was an issue initialising the plugin, skip adding its extensions to the registry
      // or if the plugin already have placed 2 items at the extension point.
      if (!item || pluginPlacementCount[placement] > 2) {
        continue;
      }

      if (!Array.isArray(registry[placement])) {
        registry[placement] = [item];
        continue;
      }

      registry[placement].push(item);
    }
  }

  for (const item of Object.keys(registry)) {
    Object.freeze(registry[item]);
  }

  return Object.freeze(registry);
}

function createRegistryLink(
  pluginId: string,
  config: AppPluginExtensionLinkConfig
): PluginExtensionRegistryItem<PluginExtensionLink> | undefined {
  if (!isValidLinkPath(pluginId, config.path)) {
    return undefined;
  }

  const id = `${pluginId}${config.placement}${config.title}`;
  const extension = Object.freeze({
    type: PluginExtensionTypes.link,
    title: config.title,
    description: config.description,
    key: hashKey(id),
    path: config.path,
  });

  return Object.freeze({
    extension: extension,
    configure: createLinkConfigure(pluginId, config, extension),
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}

function createLinkConfigure(
  pluginId: string,
  config: AppPluginExtensionLinkConfig,
  extension: PluginExtensionLink
): RegistryConfigureExtension<PluginExtensionLink> | undefined {
  if (!config.configure) {
    return undefined;
  }

  const options = {
    pluginId: pluginId,
    title: config.title,
    logger: console.warn,
  };

  const mapper = mapToRegistryType(extension);
  const validator = createLinkValidator(options);
  const errorHandler = createErrorHandling<AppPluginExtensionLink>(options);

  return mapper(validator(errorHandler(config.configure)));
}

function mapToRegistryType(
  extension: PluginExtensionLink
): (configure: AppConfigureExtension<AppPluginExtensionLink>) => RegistryConfigureExtension<PluginExtensionLink> {
  const configurable: AppPluginExtensionLink = {
    title: extension.title,
    description: extension.description,
    path: extension.path,
  };

  return (configure) => {
    return function mapper(context: object): PluginExtensionLink | undefined {
      const configured = configure(configurable, context);

      if (!configured) {
        return undefined;
      }

      return {
        ...extension,
        title: configured.title ?? extension.title,
        description: configured.description ?? extension.description,
        path: configured.path ?? extension.path,
      };
    };
  };
}
