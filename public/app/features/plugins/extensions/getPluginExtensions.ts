import {
  type PluginExtension,
  PluginExtensionTypes,
  PluginExtensionLink,
  PluginExtensionLinkConfig,
} from '@grafana/data';

import type { PluginExtensionRegistry } from './types';
import { isPluginExtensionLinkConfig, deepFreeze, logWarning, generateExtensionId, getEventHelpers } from './utils';
import { assertIsNotPromise, assertLinkPathIsValid, assertStringProps, isPromise } from './validators';

type GetExtensions = ({
  context,
  placement,
  registry,
}: {
  context?: object | Record<string | symbol, unknown>;
  placement: string;
  registry: PluginExtensionRegistry;
}) => { extensions: PluginExtension[] };

// Returns with a list of plugin extensions for the given placement
export const getPluginExtensions: GetExtensions = ({ context, placement, registry }) => {
  const frozenContext = context ? deepFreeze(context) : {};
  const registryItems = registry[placement] ?? [];
  // We don't return the extensions separated by type, because in that case it would be much harder to define a sort-order for them.
  const extensions: PluginExtension[] = [];

  for (const registryItem of registryItems) {
    try {
      const extensionConfig = registryItem.config;

      if (isPluginExtensionLinkConfig(extensionConfig)) {
        const overrides = getLinkExtensionOverrides(registryItem.pluginId, extensionConfig, frozenContext);

        // Hide (configure() has returned `undefined`)
        if (extensionConfig.configure && overrides === undefined) {
          continue;
        }

        const extension: PluginExtensionLink = {
          id: generateExtensionId(registryItem.pluginId, extensionConfig),
          type: PluginExtensionTypes.link,
          pluginId: registryItem.pluginId,
          onClick: getLinkExtensionOnClick(extensionConfig, frozenContext),

          // Configurable properties
          title: overrides?.title || extensionConfig.title,
          description: overrides?.description || extensionConfig.description,
          path: overrides?.path || extensionConfig.path,
        };

        extensions.push(extension);
      }
    } catch (error) {
      if (error instanceof Error) {
        logWarning(error.message);
      }
    }
  }

  return { extensions };
};

function getLinkExtensionOverrides(pluginId: string, config: PluginExtensionLinkConfig, context?: object) {
  try {
    const overrides = config.configure?.(context);

    // Hiding the extension
    if (overrides === undefined) {
      return undefined;
    }

    let { title = config.title, description = config.description, path = config.path, ...rest } = overrides;

    assertIsNotPromise(
      overrides,
      `The configure() function for "${config.title}" returned a promise, skipping updates.`
    );

    path && assertLinkPathIsValid(pluginId, path);
    assertStringProps({ title, description }, ['title', 'description']);

    if (Object.keys(rest).length > 0) {
      throw new Error(
        `Invalid extension "${config.title}". Trying to override not-allowed properties: ${Object.keys(rest).join(
          ', '
        )}`
      );
    }

    return {
      title,
      description,
      path,
    };
  } catch (error) {
    if (error instanceof Error) {
      logWarning(error.message);
    }

    // If there is an error, we hide the extension
    // (This seems to be safest option in case the extension is doing something wrong.)
    return undefined;
  }
}

function getLinkExtensionOnClick(
  config: PluginExtensionLinkConfig,
  context?: object
): ((event: React.MouseEvent) => void) | undefined {
  const { onClick } = config;

  if (!onClick) {
    return;
  }

  return function onClickExtensionLink(event: React.MouseEvent) {
    try {
      const result = onClick(event, getEventHelpers(context));

      if (isPromise(result)) {
        result.catch((e) => {
          if (e instanceof Error) {
            logWarning(e.message);
          }
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        logWarning(error.message);
      }
    }
  };
}
