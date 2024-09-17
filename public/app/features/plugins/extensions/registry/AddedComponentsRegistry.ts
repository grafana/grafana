import { ReplaySubject } from 'rxjs';

import { PluginExtensionAddedComponentConfig } from '@grafana/data';

import { wrapWithPluginContext } from '../utils';
import {
  extensionPointEndsWithVersion,
  isExtensionPointIdValid,
  isGrafanaCoreExtensionPoint,
  isReactComponent,
} from '../validators';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

export type AddedComponentRegistryItem<Props = {}> = {
  pluginId: string;
  title: string;
  description: string;
  component: React.ComponentType<Props>;
};

export class AddedComponentsRegistry extends Registry<
  AddedComponentRegistryItem[],
  PluginExtensionAddedComponentConfig
> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<AddedComponentRegistryItem[]>>;
      initialState?: RegistryType<AddedComponentRegistryItem[]>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<AddedComponentRegistryItem[]>,
    item: PluginExtensionConfigs<PluginExtensionAddedComponentConfig>
  ): RegistryType<AddedComponentRegistryItem[]> {
    const { pluginId, configs } = item;

    for (const config of configs) {
      const configLog = this.logger.child({
        description: config.description,
        title: config.title,
        pluginId,
      });

      if (!isReactComponent(config.component)) {
        configLog.error(
          `Could not register added component. Reason: The provided component is not a valid React component.`
        );
        continue;
      }

      if (!config.title) {
        configLog.error(`Could not register added component. Reason: Title is missing.`);
        continue;
      }

      if (!config.description) {
        configLog.error(`Could not register added component. Reason: Description is missing.`);
        continue;
      }

      const extensionPointIds = Array.isArray(config.targets) ? config.targets : [config.targets];
      for (const extensionPointId of extensionPointIds) {
        const pointIdLog = configLog.child({ id: extensionPointId });

        if (!isExtensionPointIdValid(pluginId, extensionPointId)) {
          pointIdLog.warning(
            `Could not register added component. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id or grafana. e.g '<grafana|myorg-basic-app>/my-component-id/v1'.`
          );
          continue;
        }

        if (!isGrafanaCoreExtensionPoint(extensionPointId) && !extensionPointEndsWithVersion(extensionPointId)) {
          pointIdLog.warning(
            `Added component does not match the convention. It's recommended to suffix the id with the component version. e.g 'myorg-basic-app/my-component-id/v1'.`
          );
        }

        const result = {
          pluginId,
          component: wrapWithPluginContext(pluginId, config.component, pointIdLog),
          description: config.description,
          title: config.title,
        };

        pointIdLog.debug(`Added component from '${pluginId}' to '${extensionPointId}'`);

        if (!(extensionPointId in registry)) {
          registry[extensionPointId] = [result];
        } else {
          registry[extensionPointId].push(result);
        }
      }
    }

    return registry;
  }

  // Returns a read-only version of the registry.
  readOnly() {
    return new AddedComponentsRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
