import { PluginExposedComponentConfig } from '@grafana/data';

import { logWarning } from '../utils';

import { Registry, RegistryType, PluginExtensionConfigs } from './Registry';

export class ExposedComponentsRegistry extends Registry<PluginExposedComponentConfig> {
  constructor(initialState: RegistryType<PluginExposedComponentConfig> = {}) {
    super({
      initialState,
    });
  }

  mapToRegistry(
    registry: RegistryType<PluginExposedComponentConfig>,
    { pluginId, configs }: PluginExtensionConfigs<PluginExposedComponentConfig>
  ): RegistryType<PluginExposedComponentConfig> {
    if (!configs) {
      return registry;
    }

    for (const config of configs) {
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
