import { isFunction, isObject } from 'lodash';

import type { CommandHandlerFunc, ConfigureFunc } from './types';

type Options = {
  pluginId: string;
  title: string;
  logger: (msg: string, error?: unknown) => void;
};

export function handleErrorsInConfigure<T>(options: Options) {
  const { pluginId, title, logger } = options;

  return (configure: ConfigureFunc<T>): ConfigureFunc<T> => {
    return function handleErrors(context) {
      try {
        if (!isFunction(configure)) {
          logger(`[Plugins] ${pluginId} provided invalid configuration function for extension '${title}'.`);
          return;
        }

        const result = configure(context);
        if (result instanceof Promise) {
          logger(
            `[Plugins] ${pluginId} provided an unsupported async/promise-based configureation function for extension '${title}'.`
          );
          result.catch(() => {});
          return;
        }

        if (!isObject(result) && typeof result !== 'undefined') {
          logger(`[Plugins] ${pluginId} returned an inccorect object in configure function for extension '${title}'.`);
          return;
        }

        return result;
      } catch (error) {
        logger(`[Plugins] ${pluginId} thow an error while configure extension '${title}'`, error);
        return;
      }
    };
  };
}

export function handleErrorsInHandler(options: Options) {
  const { pluginId, title, logger } = options;

  return (handler: CommandHandlerFunc): CommandHandlerFunc => {
    return function handleErrors(context) {
      try {
        if (!isFunction(handler)) {
          logger(`[Plugins] ${pluginId} provided invalid handler function for command extension '${title}'.`);
          return;
        }

        const result = handler(context);
        if (result instanceof Promise) {
          logger(
            `[Plugins] ${pluginId} provided an unsupported async/promise-based handler function for command extension '${title}'.`
          );
          result.catch(() => {});
          return;
        }

        return result;
      } catch (error) {
        logger(`[Plugins] ${pluginId} thow an error while handling command extension '${title}'`, error);
        return;
      }
    };
  };
}
