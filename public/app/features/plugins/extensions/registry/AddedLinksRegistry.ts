import { IconName, PluginAddedLinkConfig } from '@grafana/data';
import { PluginAddedLinksConfigureFunc, PluginExtensionEventHelpers } from '@grafana/data/src/types/pluginExtensions';

import { logWarning } from '../utils';
import {
  extensionPointEndsWithVersion,
  isConfigureFnValid,
  isExtensionPointIdValid,
  isLinkPathValid,
} from '../validators';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

export type AddedLinkRegistryItem<Context extends object = object> = {
  pluginId: string;
  title: string;
  description: string;
  onClick?: (event: React.MouseEvent | undefined, helpers: PluginExtensionEventHelpers<Context>) => void;
  configure?: PluginAddedLinksConfigureFunc<Context>;
  icon?: IconName;
  category?: string;
};

export class AddedLinksRegistry extends Registry<AddedLinkRegistryItem[], PluginAddedLinkConfig> {
  constructor(initialState: RegistryType<AddedLinkRegistryItem[]> = {}) {
    super({
      initialState,
    });
  }

  mapToRegistry(
    registry: RegistryType<AddedLinkRegistryItem[]>,
    item: PluginExtensionConfigs<PluginAddedLinkConfig>
  ): RegistryType<AddedLinkRegistryItem[]> {
    const { pluginId, configs } = item;

    for (const { path, title, description, configure, onClick, targets, icon, category } of configs) {
      if (!title) {
        logWarning(`Could not register added link with title '${title}'. Reason: Title is missing.`);
        continue;
      }

      if (!description) {
        logWarning(`Could not register added link with title '${title}'. Reason: Description is missing.`);
        continue;
      }

      if (!isConfigureFnValid(configure)) {
        logWarning(`Could not register added link with title '${title}'. Reason: configure is not a function.`);
        continue;
      }

      if (!path && !onClick) {
        logWarning(
          `Could not register added link with title '${title}'. Reason: Either "path" or "onClick" is required.`
        );
        continue;
      }

      if (path && !isLinkPathValid(pluginId, path)) {
        logWarning(
          `Could not register added link with title '${title}'. Reason: The "path" is required and should start with "/a/${pluginId}/" (currently: "${path}"). Skipping the extension.`
        );
        continue;
      }

      const extensionPointIds = Array.isArray(targets) ? targets : [targets];
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
          title,
          description,
          onClick,
          configure,
          icon,
          category,
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
