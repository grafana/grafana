import { ReplaySubject } from 'rxjs';

import { PluginExtensionExposedComponentConfig } from '@grafana/data';

import * as errors from '../errors';
import { isGrafanaDevMode } from '../utils';
import { isExposedComponentMetaInfoMissing } from '../validators';

import { Registry, RegistryType, PluginExtensionConfigs } from './Registry';

const logPrefix = 'Could not register exposed component. Reason:';

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
        pointIdLog.error(`${logPrefix} ${errors.INVALID_EXPOSED_COMPONENT_ID}`);
        continue;
      }

      if (registry[id]) {
        pointIdLog.error(`${logPrefix} ${errors.EXPOSED_COMPONENT_ALREADY_EXISTS}`);
        continue;
      }

      if (!title) {
        pointIdLog.error(`${logPrefix} ${errors.TITLE_MISSING}`);
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
