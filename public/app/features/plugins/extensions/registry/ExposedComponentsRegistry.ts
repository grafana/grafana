import { ReplaySubject } from 'rxjs';

import { PluginExtensionExposedComponentConfig } from '@grafana/data';

import { isGrafanaDevMode } from '../utils';
import { isExposedComponentMetaInfoMissing } from '../validators';

import { Registry, RegistryType, PluginExtensionConfigs } from './Registry';

export type ExposedComponentRegistryItem<Props = {}> = {
  pluginId: string;
  title: string;
  description: string;
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
        description,
        title,
        pluginId,
      });

      if (!id.startsWith(pluginId)) {
        pointIdLog.error(
          `Could not register exposed component extension. Reason: The component id does not match the id naming convention. Id should be prefixed with plugin id. e.g 'myorg-basic-app/my-component-id/v1'.`
        );
        continue;
      }

      if (registry[id]) {
        pointIdLog.error(
          `Could not register exposed component extension. Reason: An exposed component with the same id already exists.`
        );
        continue;
      }

      if (!title) {
        pointIdLog.error('Could not register exposed component extension. Reason: Title is missing.');
        continue;
      }

      if (!description) {
        pointIdLog.error('Could not register exposed component extension. Reason: Description is missing.');
        continue;
      }

      if (
        pluginId !== 'grafana' &&
        isGrafanaDevMode() &&
        isExposedComponentMetaInfoMissing(pluginId, config, pointIdLog)
      ) {
        continue;
      }

      pointIdLog.debug('Exposed component extension successfully registered');

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
