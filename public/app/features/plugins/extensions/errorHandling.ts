import { isFunction, isObject } from 'lodash';

import type { AppConfigureExtension } from '@grafana/data';

type Options = {
  pluginId: string;
  title: string;
  logger: (msg: string, error?: unknown) => void;
};

export function createErrorHandling<T>(options: Options) {
  const { pluginId, title, logger } = options;

  return (configure: AppConfigureExtension<T>): AppConfigureExtension<T> => {
    return function handleErrors(extension, context) {
      try {
        if (!isFunction(configure)) {
          logger(`[Plugins] ${pluginId} provided invalid configuration function for extension '${title}'.`);
          return;
        }

        const result = configure(extension, context);
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
