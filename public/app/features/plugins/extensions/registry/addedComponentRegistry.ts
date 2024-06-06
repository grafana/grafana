import { PluginExtensionComponentConfig } from '@grafana/data';

import { PluginPreloadResult } from '../../pluginPreloader';

import { Registry } from './registry';
import { registryLog } from './registryLog';

export type AddedComponent = PluginExtensionComponentConfig & {
  pluginId: string;
};

type RegistryType = {
  [target: string]: AddedComponent[];
};

export class AddedComponentRegistry extends Registry<RegistryType> {
  constructor(initialState: RegistryType = {}) {
    super({
      initialState,
    });
  }

  mapToRegistry(registry: RegistryType, item: PluginPreloadResult): RegistryType {
    const { pluginId, addedComponents, error } = item;

    if (error) {
      registryLog.error({
        message: 'Plugin failed to load, skip adding its components to targets.',
        pluginId,
        error,
      });
      return registry;
    }

    if (!addedComponents) {
      return registry;
    }

    for (const config of addedComponents) {
      const { extensionPointId } = config;

      // check if config is valid, skip and warn if invalid.
      // if(isConfigValid(config)) { ... }

      if (!Array.isArray(registry[extensionPointId])) {
        registry[extensionPointId] = [];
      }

      registry[extensionPointId].push({
        pluginId,
        ...config,
      });
    }

    return registry;
  }
}

