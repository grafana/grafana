import type { AppPluginConfig } from '@grafana/data';

import { ExtensionPointPluginMeta, getAppPluginIdFromExposedComponentId } from './utils';

/**
 * Returns a list of app plugin configs that match the given plugin ids.
 * @param pluginIds - The list of plugin ids to filter by.
 * @param apps - The app plugin configs.
 * @returns A list of app plugin configs that match the given plugin ids.
 */
export function getAppPluginConfigs(pluginIds: string[] = [], apps: AppPluginConfig[] = []): AppPluginConfig[] {
  return apps.filter((app) => pluginIds.includes(app.id));
}

/**
 * Returns a list of app plugin ids that are registering extensions to this extension point.
 * (These plugins are necessary to be loaded to use the extension point.)
 * (The function also returns the plugin ids that the plugins - that extend the extension point - depend on.)
 * @param extensionPointId - The id of the extension point.
 * @param apps - The app plugin configs.
 * @returns A list of app plugin ids that are registering extensions to this extension point.
 */

export function getExtensionPointPluginDependencies(extensionPointId: string, apps: AppPluginConfig[] = []): string[] {
  return apps
    .filter(
      (app) =>
        app.extensions.addedLinks.some((link) => link.targets.includes(extensionPointId)) ||
        app.extensions.addedComponents.some((component) => component.targets.includes(extensionPointId))
    )
    .map((app) => app.id)
    .reduce((acc: string[], id: string) => {
      return [...acc, id, ...getAppPluginDependencies(id, undefined, apps)];
    }, []);
}

/**
 * Returns a map of plugin ids and their addedComponents and addedLinks to the extension point.
 * @param extensionPointId - The id of the extension point.
 * @param apps - The app plugin configs.
 * @returns A map of plugin ids and their addedComponents and addedLinks to the extension point.
 */
export function getExtensionPointPluginMeta(
  extensionPointId: string,
  apps: AppPluginConfig[] = []
): ExtensionPointPluginMeta {
  return new Map(
    getExtensionPointPluginDependencies(extensionPointId, apps)
      .map((pluginId) => {
        const app = apps.find((app) => app.id === pluginId);
        // if the plugin does not exist or does not expose any components or links to the extension point, return undefined
        if (
          !app ||
          (!app.extensions.addedComponents.some((component) => component.targets.includes(extensionPointId)) &&
            !app.extensions.addedLinks.some((link) => link.targets.includes(extensionPointId)))
        ) {
          return undefined;
        }
        return [
          pluginId,
          {
            addedComponents: app.extensions.addedComponents.filter((component) =>
              component.targets.includes(extensionPointId)
            ),
            addedLinks: app.extensions.addedLinks.filter((link) => link.targets.includes(extensionPointId)),
          },
        ] as const;
      })
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
  );
}

/**
 * Returns a list of app plugin ids that are necessary to be loaded to use the exposed component.
 * @param apps - The app plugin configs.
 * @param exposedComponentId - The id of the exposed component.
 * @returns A list of app plugin ids that are necessary to be loaded to use the exposed component.
 */

export function getExposedComponentPluginDependencies(
  exposedComponentId: string,
  apps: AppPluginConfig[] = []
): string[] {
  const pluginId = getAppPluginIdFromExposedComponentId(exposedComponentId);

  return [pluginId].reduce((acc: string[], pluginId: string) => {
    return [...acc, pluginId, ...getAppPluginDependencies(pluginId, undefined, apps)];
  }, []);
}

/**
 * Returns a list of app plugin ids that are necessary to be loaded, based on the `dependencies.extensions`
 * metadata field. (For example the plugins that expose components that the app depends on.)
 * Heads up! This is a recursive function.
 * @param pluginId - The id of the plugin.
 * @param visited - The list of plugin ids that have already been visited.
 * @param apps - The app plugin configs.
 * @returns A list of app plugin ids that are necessary to be loaded, based on the `dependencies.extensions`
 */
export function getAppPluginDependencies(
  pluginId: string,
  visited: string[] = [],
  apps: AppPluginConfig[] = []
): string[] {
  const plugin = apps.find((app) => app.id === pluginId);
  if (!plugin) {
    return [];
  }

  // Prevent infinite recursion (it would happen if there is a circular dependency between app plugins)
  if (visited.includes(pluginId)) {
    return [];
  }

  const pluginIdDependencies = plugin.dependencies.extensions.exposedComponents.map(
    getAppPluginIdFromExposedComponentId
  );

  return (
    pluginIdDependencies
      .reduce((acc, _pluginId) => {
        return [...acc, ...getAppPluginDependencies(_pluginId, [...visited, pluginId], apps)];
      }, pluginIdDependencies)
      // We don't want the plugin to "depend on itself"
      .filter((id) => id !== pluginId)
  );
}

/**
 * Returns a list of app plugins that has to be loaded before core Grafana could finish the initialization.
 * @param apps - The app plugin configs.
 * @returns A list of app plugins that has to be loaded before core Grafana could finish the initialization.
 */
export function getAppPluginsToAwait(apps: AppPluginConfig[]) {
  const pluginIds = [
    // The "cloud-home-app" is registering banners once it's loaded, and this can cause a rerender in the AppChrome if it's loaded after the Grafana app init.
    'cloud-home-app',
  ];

  return apps.filter((app) => pluginIds.includes(app.id));
}
