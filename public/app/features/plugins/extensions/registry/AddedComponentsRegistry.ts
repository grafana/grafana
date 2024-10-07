import { ReplaySubject } from 'rxjs';

import { PluginExtensionAddedComponentConfig } from '@grafana/data';

import { isAddedComponentMetaInfoMissing, isGrafanaDevMode, logWarning, wrapWithPluginContext } from '../utils';
import { extensionPointEndsWithVersion, isGrafanaCoreExtensionPoint, isReactComponent } from '../validators';

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

      if (pluginId !== 'grafana' && isGrafanaDevMode() && isAddedComponentMetaInfoMissing(pluginId, config)) {
        continue;
      }

      const extensionPointIds = Array.isArray(config.targets) ? config.targets : [config.targets];
      for (const extensionPointId of extensionPointIds) {
        if (!isGrafanaCoreExtensionPoint(extensionPointId) && !extensionPointEndsWithVersion(extensionPointId)) {
          logWarning(
            `Added component "${config.title}": it's recommended to suffix the extension point id ("${extensionPointId}") with a version, e.g 'myorg-basic-app/extension-point/v1'.`
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

  // Returns a read-only version of the registry.
  readOnly() {
    return new AddedComponentsRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
