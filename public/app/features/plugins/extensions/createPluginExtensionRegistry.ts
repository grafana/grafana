import type { PluginPreloadResult } from '../pluginPreloader';

import { MAX_EXTENSIONS_PER_POINT } from './constants';
import { ExtensionsPerPlugin } from './extensionsPerPlugin';
import type { PluginExtensionRegistryItem, PluginExtensionRegistry } from './types';
import { deepFreeze, logWarning } from './utils';
import { isPluginExtensionConfigValid } from './validators';

export function createPluginExtensionRegistry(pluginPreloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};
  const extensionsPerPlugin = new ExtensionsPerPlugin();

  for (const { pluginId, extensionConfigs, error } of pluginPreloadResults) {
    if (error) {
      logWarning(`"${pluginId}" plugin failed to load, skip registering its extensions.`);
      continue;
    }

    for (const extensionConfig of extensionConfigs) {
      const { extensionPointId } = extensionConfig;

      if (!extensionsPerPlugin.allowedToAdd(extensionConfig)) {
        logWarning(
          `"${pluginId}" plugin has reached the limit of ${MAX_EXTENSIONS_PER_POINT} for "${extensionPointId}", skip registering extension "${extensionConfig.title}".`
        );
        continue;
      }

      if (!extensionConfig || !isPluginExtensionConfigValid(pluginId, extensionConfig)) {
        continue;
      }

      let registryItem: PluginExtensionRegistryItem = {
        config: extensionConfig,

        // Additional meta information about the extension
        pluginId,
      };

      if (!Array.isArray(registry[extensionPointId])) {
        registry[extensionPointId] = [registryItem];
      } else {
        registry[extensionPointId].push(registryItem);
      }
    }
  }

  return deepFreeze(registry);
}
