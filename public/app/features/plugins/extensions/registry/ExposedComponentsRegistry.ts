import { PluginExposedComponentConfig } from '@grafana/data';

import { PluginPreloadResult } from '../../pluginPreloader';
import { logWarning } from '../utils';

import { Registry } from './Registry';

export type RegistryType = {
  [id: string]: {
    pluginId: string;
    config: PluginExposedComponentConfig;
  };
};

export class ExposedComponentsRegistry extends Registry<RegistryType> {
  constructor(initialState: RegistryType = {}) {
    super({
      initialState,
    });
  }

  mapToRegistry(registry: RegistryType, item: PluginPreloadResult): RegistryType {
    const { pluginId, exposedComponentConfigs, error } = item;

    if (error) {
      logWarning(`"${pluginId}" plugin failed to load. Skip registering its exposed components.`);
      return registry;
    }

    if (!exposedComponentConfigs) {
      return registry;
    }

    for (const config of exposedComponentConfigs) {
      const { id, description, title } = config;

      if (!id.startsWith(pluginId)) {
        logWarning(
          `Could not register exposed component with id '${id}'. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id. e.g 'myorg-basic-app/my-component-id/v1'.`
        );
        continue;
      }

      if (!id.match(/.*\/v\d+$/)) {
        logWarning(
          `Exposed component with id '${id}' does not match the convention. It's recommended to suffix the id with the component version. e.g 'myorg-basic-app/my-component-id/v1'.`
        );
      }

      if (registry[id]) {
        logWarning(
          `Could not register exposed component with id '${id}'. Reason: An exposed component with the same id already exists.`
        );
        continue;
      }

      if (!title) {
        logWarning(`Could not register exposed component with id '${id}'. Reason: Title is missing.`);
        continue;
      }

      if (!description) {
        logWarning(`Could not register exposed component with id '${id}'. Reason: Description is missing.`);
        continue;
      }

      registry[id] = { config, pluginId };
    }

    return registry;
  }
}
