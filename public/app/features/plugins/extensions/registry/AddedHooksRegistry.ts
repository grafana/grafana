import { ReplaySubject } from 'rxjs';

import { PluginExtensionAddedHookConfig } from '@grafana/data';

import * as errors from '../errors';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

const logPrefix = 'Could not register component extension. Reason:';

export type AddedHooksRegistryItem = {
  pluginId: string;
  hook: any;
};

export class AddedHooksRegistry extends Registry<AddedHooksRegistryItem[], PluginExtensionAddedHookConfig> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<AddedHooksRegistryItem[]>>;
      initialState?: RegistryType<AddedHooksRegistryItem[]>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<AddedHooksRegistryItem[]>,
    item: PluginExtensionConfigs<PluginExtensionAddedHookConfig>
  ): RegistryType<AddedHooksRegistryItem[]> {
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

      const extensionPointIds = Array.isArray(config.targets) ? config.targets : [config.targets];
      for (const extensionPointId of extensionPointIds) {
        const pointIdLog = configLog.child({ extensionPointId });

        const result = {
          pluginId,
          hook: config.hook,
        };

        pointIdLog.debug('Added component extension successfully registered');

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
    return new AddedHooksRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
