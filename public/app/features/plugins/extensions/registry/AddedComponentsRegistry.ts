import { PluginAddedComponentConfig } from '@grafana/data';

import { logWarning, wrapWithPluginContext } from '../utils';
import { extensionPointEndsWithVersion, isExtensionPointIdValid, isReactComponent } from '../validators';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

export type AddedComponentRegistryItem<Props = {}> = {
  pluginId: string;
  title: string;
  description: string;
  component: React.ComponentType<Props>;
};

export class AddedComponentsRegistry extends Registry<AddedComponentRegistryItem[], PluginAddedComponentConfig> {
  constructor(initialState: RegistryType<AddedComponentRegistryItem[]> = {}) {
    super({
      initialState,
    });
  }

  mapToRegistry(
    registry: RegistryType<AddedComponentRegistryItem[]>,
    item: PluginExtensionConfigs<PluginAddedComponentConfig>
  ): RegistryType<AddedComponentRegistryItem[]> {
    const { pluginId, configs } = item;

    for (const config of configs) {
      if (!isReactComponent(config.component)) {
        logWarning(
          `Could not register added component with title '${config.title}'. Reason: The provided component is not a valid React component.`
        );
        continue;
      }

      if (!config.title) {
        logWarning(`Could not register added component with title '${config.title}'. Reason: Title is missing.`);
        continue;
      }

      if (!config.description) {
        logWarning(`Could not register added component with title '${config.title}'. Reason: Description is missing.`);
        continue;
      }

      const extensionPointIds = Array.isArray(config.targets) ? config.targets : [config.targets];
      for (const extensionPointId of extensionPointIds) {
        if (!isExtensionPointIdValid(pluginId, extensionPointId)) {
          logWarning(
            `Could not register added component with id '${extensionPointId}'. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id or grafana. e.g '<grafana|myorg-basic-app>/my-component-id/v1'.`
          );
          continue;
        }

        if (!extensionPointEndsWithVersion(extensionPointId)) {
          logWarning(
            `Added component with id '${extensionPointId}' does not match the convention. It's recommended to suffix the id with the component version. e.g 'myorg-basic-app/my-component-id/v1'.`
          );
        }

        const result = {
          pluginId,
          component: wrapWithPluginContext(pluginId, config.component),
          description: config.description,
          title: config.title,
        };

        if (!(extensionPointId in registry)) {
          registry[extensionPointId] = [result];
        } else {
          registry[extensionPointId].push(result);
        }
      }
    }

    return registry;
  }
}
