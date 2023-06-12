import type { PluginPreloadResult } from '../pluginPreloader';

import type { PluginExtensionRegistryItem, PluginExtensionRegistry } from './types';
import { deepFreeze, logWarning } from './utils';
import { isPluginExtensionConfigValid } from './validators';

export function createPluginExtensionRegistry(pluginPreloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};

  for (const { pluginId, extensionConfigs, error } of pluginPreloadResults) {
    if (error) {
      logWarning(`"${pluginId}" plugin failed to load, skip registering its extensions.`);
      continue;
    }

    for (const extensionConfig of extensionConfigs) {
      const { extensionPointId } = extensionConfig;

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
