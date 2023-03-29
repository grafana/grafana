import {
  type AppPluginExtensionCommand,
  type AppPluginExtensionCommandConfig,
  type AppPluginExtensionCommandHelpers,
  type AppPluginExtensionLink,
  type AppPluginExtensionLinkConfig,
  type PluginExtension,
  type PluginExtensionCommand,
  type PluginExtensionLink,
  PluginExtensionTypes,
} from '@grafana/data';
import type { PluginExtensionRegistry, PluginExtensionRegistryItem } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import type { PluginPreloadResult } from '../pluginPreloader';

import { handleErrorsInHandler, handleErrorsInConfigure } from './errorHandling';
import { getModalWrapper } from './getModalWrapper';
import { PlacementsPerPlugin } from './placementsPerPlugin';
import { CommandHandlerFunc, ConfigureFunc } from './types';
import { createLinkValidator, isValidLinkPath } from './validateLink';

export function createPluginExtensionRegistry(preloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};

  for (const result of preloadResults) {
    const { pluginId, linkExtensions, commandExtensions, error } = result;

    if (error) {
      continue;
    }

    const placementsPerPlugin = new PlacementsPerPlugin();
    const configs = [...linkExtensions, ...commandExtensions];

    for (const config of configs) {
      const placement = config.placement;
      const item = createRegistryItem(pluginId, config);

      if (!item || !placementsPerPlugin.allowedToAdd(placement)) {
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

function createRegistryItem(
  pluginId: string,
  config: AppPluginExtensionCommandConfig | AppPluginExtensionLinkConfig
): PluginExtensionRegistryItem | undefined {
  if ('handler' in config) {
    return createCommandRegistryItem(pluginId, config);
  }
  return createLinkRegistryItem(pluginId, config);
}

function createCommandRegistryItem(
  pluginId: string,
  config: AppPluginExtensionCommandConfig
): PluginExtensionRegistryItem<PluginExtensionCommand> | undefined {
  const configure = config.configure ?? defaultConfigure;
  const helpers = getCommandHelpers();

  const options = {
    pluginId: pluginId,
    title: config.title,
    logger: console.warn,
  };

  const handlerWithHelpers: CommandHandlerFunc = (context) => config.handler(context, helpers);
  const catchErrorsInHandler = handleErrorsInHandler(options);
  const handler = catchErrorsInHandler(handlerWithHelpers);

  const extensionFactory = createCommandFactory(pluginId, config, handler);
  const mapper = mapToConfigure<PluginExtensionCommand, AppPluginExtensionCommand>(extensionFactory);
  const catchErrorsInConfigure = handleErrorsInConfigure<AppPluginExtensionCommand>(options);

  return mapper(catchErrorsInConfigure(configure));
}

function createLinkRegistryItem(
  pluginId: string,
  config: AppPluginExtensionLinkConfig
): PluginExtensionRegistryItem<PluginExtensionLink> | undefined {
  if (!isValidLinkPath(pluginId, config.path)) {
    return undefined;
  }

  const configure = config.configure ?? defaultConfigure;
  const options = { pluginId: pluginId, title: config.title, logger: console.warn };

  const extensionFactory = createLinkFactory(pluginId, config);
  const mapper = mapToConfigure<PluginExtensionLink, AppPluginExtensionLink>(extensionFactory);
  const withConfigureErrorHandling = handleErrorsInConfigure<AppPluginExtensionLink>(options);
  const validateLink = createLinkValidator(options);

  return mapper(validateLink(withConfigureErrorHandling(configure)));
}

function createLinkFactory(pluginId: string, config: AppPluginExtensionLinkConfig) {
  return (override: Partial<AppPluginExtensionLink>): PluginExtensionLink => {
    const title = override?.title ?? config.title;
    const description = override?.description ?? config.description;
    const path = override?.path ?? config.path;

    return Object.freeze({
      type: PluginExtensionTypes.link,
      title: title,
      description: description,
      path: path,
      key: hashKey(`${pluginId}${config.placement}${title}`),
    });
  };
}

function createCommandFactory(
  pluginId: string,
  config: AppPluginExtensionCommandConfig,
  handler: (context?: object) => void
) {
  return (override: Partial<AppPluginExtensionCommand>, context?: object): PluginExtensionCommand => {
    const title = override?.title ?? config.title;
    const description = override?.description ?? config.description;

    return Object.freeze({
      type: PluginExtensionTypes.command,
      title: title,
      description: description,
      key: hashKey(`${pluginId}${config.placement}${title}`),
      callHandlerWithContext: () => handler(context),
    });
  };
}

function mapToConfigure<T extends PluginExtension, C>(
  extensionFactory: (override: Partial<C>, context?: object) => T | undefined
): (configure: ConfigureFunc<C>) => PluginExtensionRegistryItem<T> {
  return (configure) => {
    return function mapToExtension(context?: object): T | undefined {
      const override = configure(context);
      if (!override) {
        return undefined;
      }
      return extensionFactory(override, context);
    };
  };
}

function hashKey(key: string): number {
  return Array.from(key).reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
}

function defaultConfigure() {
  return {};
}

function getCommandHelpers() {
  const openModal: AppPluginExtensionCommandHelpers['openModal'] = ({ title, body }) => {
    appEvents.publish(new ShowModalReactEvent({ component: getModalWrapper({ title, body }) }));
  };

  return { openModal };
}
