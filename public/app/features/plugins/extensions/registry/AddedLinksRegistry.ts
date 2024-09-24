import { ReplaySubject } from 'rxjs';

import { IconName, PluginExtensionAddedLinkConfig } from '@grafana/data';
import { PluginAddedLinksConfigureFunc, PluginExtensionEventHelpers } from '@grafana/data/src/types/pluginExtensions';

import {
  extensionPointEndsWithVersion,
  isConfigureFnValid,
  isExtensionPointIdValid,
  isGrafanaCoreExtensionPoint,
  isLinkPathValid,
} from '../validators';

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
        path,
        description,
        title,
        pluginId,
        onClick: typeof onClick,
      });

      if (!title) {
        configLog.error(`Could not register added link. Reason: Title is missing.`);
        continue;
      }

      if (!description) {
        configLog.error(`Could not register added link. Reason: Description is missing.`);
        continue;
      }

      if (!isConfigureFnValid(configure)) {
        configLog.error(`Could not register added link. Reason: configure is not a function.`);
        continue;
      }

      if (!path && !onClick) {
        configLog.error(`Could not register added. Reason: Either "path" or "onClick" is required.`);
        continue;
      }

      if (path && !isLinkPathValid(pluginId, path)) {
        configLog.error(
          `Could not register added link. Reason: The "path" is required and should start with "/a/${pluginId}/".`
        );
        continue;
      }

      const extensionPointIds = Array.isArray(targets) ? targets : [targets];
      for (const extensionPointId of extensionPointIds) {
        const pointIdLog = configLog.child({ extensionPointId });

        if (!isExtensionPointIdValid(pluginId, extensionPointId)) {
          pointIdLog.error(
            `Could not register added link. Reason: Target extension point id must start with grafana, plugins or plugin id.`
          );
          continue;
        }

        if (!isGrafanaCoreExtensionPoint(extensionPointId) && !extensionPointEndsWithVersion(extensionPointId)) {
          pointIdLog.error(
            `Added link does not match the convention. It's recommended to suffix the id with the component version. e.g 'myorg-basic-app/my-component-id/v1'.`
          );
        }

        const { targets, ...registryItem } = config;

        if (!(extensionPointId in registry)) {
          registry[extensionPointId] = [];
        }

        pointIdLog.debug(`Added link from '${pluginId}' to '${extensionPointId}'`);

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
