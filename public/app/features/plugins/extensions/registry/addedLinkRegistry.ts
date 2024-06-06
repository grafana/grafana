import { PluginExtensionLinkConfig } from '@grafana/data';

import { PluginPreloadResult } from '../../pluginPreloader';

import { Registry } from './registry';
import { registryLog } from './registryLog';

export type AddedLink = PluginExtensionLinkConfig & {
  pluginId: string;
};

type RegistryType = {
  [target: string]: AddedLink[];
};

export class AddedLinkRegistry extends Registry<RegistryType> {
  constructor(initialState: RegistryType = {}) {
    super({
      initialState,
    });
  }

  mapToRegistry(registry: RegistryType, item: PluginPreloadResult): RegistryType {
    const { pluginId, addedLinks, error } = item;

    if (error) {
      registryLog.error({
        message: 'Plugin failed to load, skip adding its links to targets.',
        pluginId,
        error,
      });
      return registry;
    }

    if (!addedLinks) {
      return registry;
    }

    for (const config of addedLinks) {
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
