import {
  type ConfiguredPluginExtension,
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
  extensionPointId,
  registry,
}: {
  context?: object | Record<string | symbol, unknown>;
  extensionPointId: string;
  registry: PluginExtensionRegistry;
}) => { extensions: PluginExtension[] };

const createExtension = (
  extensionConfig: PluginExtensionLinkConfig,
  pluginId: string,
  frozenContext: object,
  overrides?: ConfiguredPluginExtension<PluginExtensionLink>
): PluginExtensionLink => ({
  id: generateExtensionId(pluginId, extensionConfig),
  type: PluginExtensionTypes.link,
  pluginId,
  onClick: getLinkExtensionOnClick(extensionConfig, frozenContext),
  // Configurable properties
  title: overrides?.title || extensionConfig.title,
  description: overrides?.description || extensionConfig.description,
  path: overrides?.path || extensionConfig.path,
});

// Returns with a list of plugin extensions for the given extension point
export const getPluginExtensions: GetExtensions = ({ context, extensionPointId, registry }) => {
  const frozenContext = context ? deepFreeze(context) : {};
  const registryItems = registry[extensionPointId] ?? [];
  // We don't return the extensions separated by type, because in that case it would be much harder to define a sort-order for them.
  const extensions: PluginExtension[] = [];

  for (const registryItem of registryItems) {
    try {
      const extensionConfig = registryItem.config;

      if (isPluginExtensionLinkConfig(extensionConfig)) {
        const overrides = getLinkExtensionOverrides(registryItem.pluginId, extensionConfig, frozenContext);
        //
        // Hide (configure() has returned `undefined`)
        if (extensionConfig.configure && overrides === undefined) {
          continue;
        }

        // No configure() and no overrides; just use the default extension config.
        if (overrides === undefined) {
          extensions.push(createExtension(extensionConfig, registryItem.pluginId, frozenContext));
          continue;
        }

        // Multiple overrides, emit an extension link for each.
        for (const override of overrides) {
          extensions.push(createExtension(extensionConfig, registryItem.pluginId, frozenContext, override));
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        logWarning(error.message);
      }
    }
  }

  return { extensions };
};

function getLinkExtensionOverrides(
  pluginId: string,
  config: PluginExtensionLinkConfig,
  context?: object
): Array<ConfiguredPluginExtension<{ path?: string }>> | undefined {
  try {
    let overrides = config.configure?.(context);

    // Hiding the extension
    if (overrides === undefined) {
      return undefined;
    }

    // For back-compat we allow returning a single override object from `configure()`.
    // Treat it as an array of length one.
    if (!Array.isArray(overrides)) {
      overrides = [overrides];
    }

    let out = [];
    for (const override of overrides) {
      let { title = config.title, description = config.description, path = config.path, ...rest } = override;

      assertIsNotPromise(
        override,
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
      out.push({ title, description, path });
    }

    return out;
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
): ((event?: React.MouseEvent) => void) | undefined {
  const { onClick } = config;

  if (!onClick) {
    return;
  }

  return function onClickExtensionLink(event?: React.MouseEvent) {
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
