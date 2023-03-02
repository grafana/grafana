import {
  AppPluginExtensionCommand,
  AppPluginExtensionCommandConfig,
  AppPluginExtensionLink,
  AppPluginExtensionLinkConfig,
  PluginExtensionCommand,
  PluginExtensionLink,
  PluginExtensionTypes,
} from '@grafana/data';
import type {
  PluginExtensionRegistry,
  PluginExtensionRegistryItem,
  RegistryConfigureExtension,
} from '@grafana/runtime';

import { PluginPreloadResult } from '../pluginPreloader';

import { commandErrorHandling, createErrorHandling } from './errorHandling';
import { ConfigureFunc, CommandHandlerFunc } from './types';
import { createLinkValidator, isValidLinkPath } from './validateLink';

export function createPluginExtensionRegistry(preloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};

  for (const result of preloadResults) {
    const limiter: Record<string, number> = {};
    const { pluginId, linkExtensions, commandExtensions, error } = result;

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

    for (const extension of commandExtensions) {
      const placement = extension.placement;

      limiter[placement] = (limiter[placement] ?? 0) + 1;
      const item = createRegistryCommand(pluginId, extension);

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

function createRegistryCommand(
  pluginId: string,
  config: AppPluginExtensionCommandConfig
): PluginExtensionRegistryItem<PluginExtensionCommand> | undefined {
  const id = `${pluginId}${config.placement}${config.title}`;

  const extension = Object.freeze({
    type: PluginExtensionTypes.command,
    title: config.title,
    description: config.description,
    key: hashKey(id),
    callHandlerWithContext: () => config.handler(),
  });

  return Object.freeze({
    extension: extension,
    configure: createCommandConfigure(pluginId, config, extension),
  });
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
): RegistryConfigureExtension<PluginExtensionLink> {
  if (!config.configure) {
    return () => extension;
  }

  const options = {
    pluginId: pluginId,
    title: config.title,
    logger: console.warn,
  };

  const mapper = mapLinkToRegistryType(extension);
  const validator = createLinkValidator(options);
  const errorHandler = createErrorHandling<AppPluginExtensionLink>(options);

  return mapper(validator(errorHandler(config.configure)));
}

function createCommandConfigure(
  pluginId: string,
  config: AppPluginExtensionCommandConfig,
  extension: PluginExtensionCommand
): RegistryConfigureExtension<PluginExtensionCommand> {
  const options = {
    pluginId: pluginId,
    title: config.title,
    logger: console.warn,
  };

  const handlerWithErrorHandler = commandErrorHandling(options);
  const handler = handlerWithErrorHandler(config.handler);

  if (!config.configure) {
    return (context) => ({
      ...extension,
      callHandlerWithContext: () => handler(context),
    });
  }

  const mapper = mapCommandToRegistryType(extension, config, handlerWithErrorHandler);
  const errorHandler = createErrorHandling<AppPluginExtensionCommand>(options);

  return mapper(errorHandler(config.configure));
}

function mapLinkToRegistryType(
  extension: PluginExtensionLink
): (configure: ConfigureFunc<AppPluginExtensionLink>) => RegistryConfigureExtension<PluginExtensionLink> {
  const configurable: AppPluginExtensionLink = {
    title: extension.title,
    description: extension.description,
    path: extension.path,
  };

  return (configure) => {
    return function mapper(context?: object): PluginExtensionLink | undefined {
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

function mapCommandToRegistryType(
  extension: PluginExtensionCommand,
  config: AppPluginExtensionCommandConfig,
  createHandlerFunc: (handler: CommandHandlerFunc) => CommandHandlerFunc
): (configure: ConfigureFunc<AppPluginExtensionCommand>) => RegistryConfigureExtension<PluginExtensionCommand> {
  const configurable: AppPluginExtensionCommand = {
    title: extension.title,
    description: extension.description,
  };

  return (configure) => {
    return function mapper(context?: object): PluginExtensionCommand | undefined {
      const configured = configure(configurable, context);

      if (!configured) {
        return undefined;
      }

      const handler = createHandlerFunc(config.handler);

      return {
        ...extension,
        title: configured.title ?? extension.title,
        description: configured.description ?? extension.description,
        callHandlerWithContext: () => handler(context),
      };
    };
  };
}
