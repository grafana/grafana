import { ReplaySubject } from 'rxjs';

import { PluginExtensionExposedComponentConfig } from '@grafana/data';

import { isExposedComponentMetaInfoMissing, isGrafanaDevMode } from '../utils';
import { extensionPointEndsWithVersion } from '../validators';

import { Registry, RegistryType, PluginExtensionConfigs } from './Registry';

export type ExposedComponentRegistryItem<Props = {}> = {
  pluginId: string;
  title: string;
  description?: string;
  component: React.ComponentType<Props>;
};

export class ExposedComponentsRegistry extends Registry<
  ExposedComponentRegistryItem,
  PluginExtensionExposedComponentConfig
> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<ExposedComponentRegistryItem>>;
      initialState?: RegistryType<ExposedComponentRegistryItem>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<ExposedComponentRegistryItem>,
    { pluginId, configs }: PluginExtensionConfigs<PluginExtensionExposedComponentConfig>
  ): RegistryType<ExposedComponentRegistryItem> {
    if (!configs) {
      return registry;
    }

    for (const config of configs) {
      const { id, description, title } = config;
      const pointIdLog = this.logger.child({
        extensionPointId: id,
        description: description ?? '',
        title,
        pluginId,
      });

      if (!id.startsWith(pluginId)) {
        pointIdLog.error(
          `Could not register exposed component with '${id}'. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id. e.g 'myorg-basic-app/my-component-id/v1'.`
        );
        continue;
      }

      if (!extensionPointEndsWithVersion(id)) {
        pointIdLog.error(
          `Exposed component does not match the convention. It's recommended to suffix the id with the component version. e.g 'myorg-basic-app/my-component-id/v1'.`
        );
      }

      if (registry[id]) {
        pointIdLog.error(
          `Could not register exposed component with '${id}'. Reason: An exposed component with the same id already exists.`
        );
        continue;
      }

      if (!title) {
        pointIdLog.error(`Could not register exposed component with id '${id}'. Reason: Title is missing.`);
        continue;
      }

      if (
        pluginId !== 'grafana' &&
        isGrafanaDevMode() &&
        isExposedComponentMetaInfoMissing(pluginId, config, pointIdLog)
      ) {
        continue;
      }

      pointIdLog.debug(`Exposed component from '${pluginId}' to '${id}'`);

      registry[id] = { ...config, pluginId };
    }

    return registry;
  }

  // Returns a read-only version of the registry.
  readOnly() {
    return new ExposedComponentsRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
