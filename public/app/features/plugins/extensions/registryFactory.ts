import { isFunction, isObject } from 'lodash';
import { compose } from 'redux';

import {
  AppPluginExtensionLink,
  AppPluginExtensionLinkConfig,
  PluginExtensionLink,
  PluginExtensionTypes,
} from '@grafana/data';
import { PluginExtensionRegistry, PluginExtensionRegistryItem } from '@grafana/runtime';

import { PluginPreloadResult } from '../pluginPreloader';

export function createPluginExtensionRegistry(preloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};

  for (const result of preloadResults) {
    const limiter: Record<string, number> = {};
    const { pluginId, linkExtensions, error } = result;

    if (!Array.isArray(linkExtensions) || error) {
      continue;
    }

    for (const extension of linkExtensions) {
      const placement = extension.placement;

      limiter[placement] = (limiter[placement] ?? 0) + 1;
      const item = createRegistryLink(pluginId, extension);

      // If there was an issue initialising the plugin, skip adding its extensions to the registry
      // or if the plugin already have placed 2 items at the extension point.
      if (!item || limiter[placement] > 2) {
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
): Readonly<PluginExtensionRegistryItem<PluginExtensionLink>> | undefined {
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
    configure: createConfigure(pluginId, config, extension),
  });
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}

type RegistryConfigureType = PluginExtensionRegistryItem<PluginExtensionLink>['configure'];
type ExtensionConfigureType = AppPluginExtensionLinkConfig['configure'];

function createConfigure(
  pluginId: string,
  config: AppPluginExtensionLinkConfig,
  extension: PluginExtensionLink
): RegistryConfigureType {
  if (!config.configure) {
    return undefined;
  }

  return compose(
    toRegistryConfigure(extension),
    withValidation(pluginId),
    withErrorHandling(pluginId, config.title),
    config.configure
  );
}

function toRegistryConfigure(
  extension: PluginExtensionLink
): (configure: ExtensionConfigureType) => RegistryConfigureType {
  return (configure) => {
    const configurable: AppPluginExtensionLink = {
      title: extension.title,
      description: extension.description,
      path: extension.path,
    };

    return function mapper(context: object): PluginExtensionLink | undefined {
      if (!configure) {
        return undefined;
      }
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

function withErrorHandling(pluginId: string, title: string) {
  return (configurer: ExtensionConfigureType): ExtensionConfigureType => {
    return function handleErrors(link, context) {
      try {
        if (!isFunction(configurer)) {
          console.error(`[Plugins] Invalid configuration function provided for extension '${title}'.`);
          return;
        }

        const result = configurer(link, context);
        if (result instanceof Promise) {
          console.error(
            `[Plugins] Can't configure extension '${title}' with an async/promise-based configuration function.`
          );
          result.catch(() => {});
          return;
        }

        if (!isObject(result) && !undefined) {
          console.error(
            `[Plugins] Will not configure extension '${title}' due to incorrect override returned from configuration function.`
          );
          return;
        }

        return result;
      } catch (error) {
        console.error(`[Plugins] Error occured while configure extension '${title}'`, error);
        return;
      }
    };
  };
}

function withValidation(pluginId: string) {
  return (configure: ExtensionConfigureType): ExtensionConfigureType => {
    const pathPrefix = `/a/${pluginId}/`;

    return function validateLink(link, context) {
      if (!configure) {
        return undefined;
      }
      const configured = configure(link, context);
      const path = configured?.path;

      if (path && !path.startsWith(pathPrefix)) {
        return undefined;
      }

      return configured;
    };
  };
}
