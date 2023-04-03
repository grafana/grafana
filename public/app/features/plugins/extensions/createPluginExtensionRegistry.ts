import type { PluginPreloadResult } from '../pluginPreloader';

import { MAX_EXTENSIONS_PER_PLACEMENT_PER_PLUGIN } from './constants';
import { PlacementsPerPlugin } from './placementsPerPlugin';
import type { PluginExtensionRegistryItem, PluginExtensionRegistry } from './types';
import { deepFreeze, logWarning } from './utils';
import { isPluginExtensionConfigValid } from './validators';

export function createPluginExtensionRegistry(pluginPreloadResults: PluginPreloadResult[]): PluginExtensionRegistry {
  const registry: PluginExtensionRegistry = {};
  const placementsPerPlugin = new PlacementsPerPlugin();

  for (const { pluginId, extensionConfigs, error } of pluginPreloadResults) {
    if (error) {
      logWarning(`"${pluginId}" plugin failed to load, skip registering its extensions.`);
      continue;
    }

    for (const extensionConfig of extensionConfigs) {
      const { placement } = extensionConfig;

      if (!placementsPerPlugin.allowedToAdd(extensionConfig)) {
        logWarning(
          `"${pluginId}" plugin has reached the limit of ${MAX_EXTENSIONS_PER_PLACEMENT_PER_PLUGIN} for "${placement}", skip registering extension "${extensionConfig.title}".`
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

      if (!Array.isArray(registry[placement])) {
        registry[placement] = [registryItem];
      } else {
        registry[placement].push(registryItem);
      }
    }
  }

  return deepFreeze(registry);
}
