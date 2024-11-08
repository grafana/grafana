import { ReplaySubject } from 'rxjs';

import { IconName, PluginExtensionAddedLinkConfig } from '@grafana/data';
import { PluginAddedLinksConfigureFunc, PluginExtensionEventHelpers } from '@grafana/data/src/types/pluginExtensions';

import { isGrafanaDevMode } from '../utils';
import { isAddedLinkMetaInfoMissing, isConfigureFnValid, isLinkPathValid } from '../validators';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

export type AddedLinkRegistryItem<Context extends object = object> = {
  pluginId: string;
  extensionPointId: string;
  title: string;
  description: string;
  path?: string;
  onClick?: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;
  configure?: PluginAddedLinksConfigureFunc<Context>;
  icon?: IconName;
  category?: string;
};

export class AddedLinksRegistry extends Registry<AddedLinkRegistryItem[], PluginExtensionAddedLinkConfig> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<AddedLinkRegistryItem[]>>;
      initialState?: RegistryType<AddedLinkRegistryItem[]>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<AddedLinkRegistryItem[]>,
    item: PluginExtensionConfigs<PluginExtensionAddedLinkConfig>
  ): RegistryType<AddedLinkRegistryItem[]> {
    const { pluginId, configs } = item;

    for (const config of configs) {
      const { path, title, description, configure, onClick, targets } = config;
      const configLog = this.logger.child({
        path: path ?? '',
        description,
        title,
        pluginId,
        onClick: typeof onClick,
      });

      if (!title) {
        configLog.error('Could not register link extension. Reason: Title is missing.');
        continue;
      }

      if (!description) {
        configLog.error('Could not register link extension. Reason: Description is missing.');
        continue;
      }

      if (!isConfigureFnValid(configure)) {
        configLog.error(
          'Could not register link extension. Reason: Invalid "configure" function. It should be a function.'
        );
        continue;
      }

      if (!path && !onClick) {
        configLog.error(`Could not register link extension. Reason: Either "path" or "onClick" is required.`);
        continue;
      }

      if (path && !isLinkPathValid(pluginId, path)) {
        configLog.error(
          `Could not register link extension. Reason: The "path" is required and should start with "/a/${pluginId}/".`
        );
        continue;
      }

      if (pluginId !== 'grafana' && isGrafanaDevMode() && isAddedLinkMetaInfoMissing(pluginId, config, configLog)) {
        continue;
      }

      const extensionPointIds = Array.isArray(targets) ? targets : [targets];

      for (const extensionPointId of extensionPointIds) {
        const pointIdLog = configLog.child({ extensionPointId });
        const { targets, ...registryItem } = config;

        if (!(extensionPointId in registry)) {
          registry[extensionPointId] = [];
        }

        pointIdLog.debug('Added link extension successfully registered');

        registry[extensionPointId].push({ ...registryItem, pluginId, extensionPointId });
      }
    }

    return registry;
  }

  // Returns a read-only version of the registry.
  readOnly() {
    return new AddedLinksRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
