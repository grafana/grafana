import { isFunction } from 'lodash';
import { ReplaySubject } from 'rxjs';

import { PluginExtensionAddedFunctionConfig } from '@grafana/data';

import * as errors from '../errors';
import { isGrafanaDevMode } from '../utils';
import { isAddedFunctionMetaInfoMissing } from '../validators';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

const logPrefix = 'Could not register function extension. Reason:';

export type AddedFunctionsRegistryItem<Signature = unknown> = {
  pluginId: string;
  title: string;
  fn: Signature;
  description?: string;
};

export class AddedFunctionsRegistry extends Registry<AddedFunctionsRegistryItem[], PluginExtensionAddedFunctionConfig> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<AddedFunctionsRegistryItem[]>>;
      initialState?: RegistryType<AddedFunctionsRegistryItem[]>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<AddedFunctionsRegistryItem[]>,
    item: PluginExtensionConfigs<PluginExtensionAddedFunctionConfig>
  ): RegistryType<AddedFunctionsRegistryItem[]> {
    const { pluginId, configs } = item;
    for (const config of configs) {
      const configLog = this.logger.child({
        title: config.title,
        pluginId,
      });

      if (!config.title) {
        configLog.error(`${logPrefix} ${errors.TITLE_MISSING}`);
        continue;
      }

      if (!isFunction(config.fn)) {
        configLog.error(`${logPrefix} ${errors.INVALID_EXTENSION_FUNCTION}`);
        continue;
      }

      if (pluginId !== 'grafana' && isGrafanaDevMode() && isAddedFunctionMetaInfoMissing(pluginId, config, configLog)) {
        continue;
      }

      const extensionPointIds = Array.isArray(config.targets) ? config.targets : [config.targets];
      for (const extensionPointId of extensionPointIds) {
        const pointIdLog = configLog.child({ extensionPointId });

        const result = {
          pluginId,
          fn: config.fn,
          description: config.description,
          title: config.title,
          extensionPointId,
        };

        pointIdLog.debug('Added function extension successfully registered');

        // Creating a new array instead of pushing to get a new reference
        const slice = registry[extensionPointId] ?? [];
        registry[extensionPointId] = [...slice, result];
      }
    }

    return registry;
  }

  // Returns a read-only version of the registry.
  readOnly() {
    return new AddedFunctionsRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
