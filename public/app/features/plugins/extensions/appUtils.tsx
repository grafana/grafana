import { AppPluginConfig, ExtensionInfo, PluginExtensionPoints } from '@grafana/data';

/**
 * Returns a list of app plugin configs that match the given plugin ids.
 * @param pluginIds - The list of plugin ids to filter by.
 * @param apps - The app plugin configs.
 * @returns A list of app plugin configs that match the given plugin ids.
 */
export function getAppPluginConfigsSync(pluginIds: string[] = [], apps: AppPluginConfig[]) {
  return apps.filter((app) => pluginIds.includes(app.id));
}

/**
 * Returns the app plugin id from the exposed component id.
 * @param exposedComponentId - The id of the exposed component.
 * @returns The app plugin id.
 */
export function getAppPluginIdFromExposedComponentId(exposedComponentId: string) {
  return exposedComponentId.split('/')[0];
}

/**
 * Returns a list of app plugin ids that are registering extensions to this extension point.
 * (These plugins are necessary to be loaded to use the extension point.)
 * (The function also returns the plugin ids that the plugins - that extend the extension point - depend on.)
 * @param extensionPointId - The id of the extension point.
 * @param apps - The app plugin configs.
 * @returns A list of app plugin ids that are registering extensions to this extension point.
 */
export function getExtensionPointPluginDependenciesSync(extensionPointId: string, apps: AppPluginConfig[]): string[] {
  return apps
    .filter(
      (app) =>
        app.extensions.addedLinks.some((link) => link.targets.includes(extensionPointId)) ||
        app.extensions.addedComponents.some((component) => component.targets.includes(extensionPointId))
    )
    .map((app) => app.id)
    .reduce((acc: string[], id: string) => {
      return [...acc, id, ...getAppPluginDependenciesSync(id, apps)];
    }, []);
}

export type ExtensionPointPluginMeta = Map<
  string,
  { readonly addedComponents: ExtensionInfo[]; readonly addedLinks: ExtensionInfo[] }
>;

/**
 * Returns a map of plugin ids and their addedComponents and addedLinks to the extension point.
 * @param extensionPointId - The id of the extension point.
 * @param apps - The app plugin configs.
 * @returns A map of plugin ids and their addedComponents and addedLinks to the extension point.
 */
export function getExtensionPointPluginMetaSync(
  extensionPointId: string,
  apps: AppPluginConfig[]
): ExtensionPointPluginMeta {
  return new Map(
    getExtensionPointPluginDependenciesSync(extensionPointId, apps)
      .map((pluginId) => {
        const app = apps.find((a) => a.id === pluginId);
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
 * (It is first the plugin that exposes the component, and then the ones that it depends on.)
 * @param exposedComponentId - The id of the exposed component.
 * @param apps - The app plugin configs.
 * @returns A list of app plugin ids that are necessary to be loaded to use the exposed component.
 */
export function getExposedComponentPluginDependenciesSync(
  exposedComponentId: string,
  apps: AppPluginConfig[]
): string[] {
  const pluginId = getAppPluginIdFromExposedComponentId(exposedComponentId);

  return [pluginId].reduce((acc: string[], pluginId: string) => {
    return [...acc, pluginId, ...getAppPluginDependenciesSync(pluginId, apps)];
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
export function getAppPluginDependenciesSync(
  pluginId: string,
  apps: AppPluginConfig[],
  visited: string[] = []
): string[] {
  const app = apps.find((a) => a.id === pluginId);
  if (!app) {
    return [];
  }

  // Prevent infinite recursion (it would happen if there is a circular dependency between app plugins)
  if (visited.includes(pluginId)) {
    return [];
  }

  const pluginIdDependencies = app.dependencies.extensions.exposedComponents.map(getAppPluginIdFromExposedComponentId);

  return (
    pluginIdDependencies
      .reduce((acc, _pluginId) => {
        return [...acc, ...getAppPluginDependenciesSync(_pluginId, apps, [...visited, pluginId])];
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
export function getAppPluginsToAwaitSync(apps: AppPluginConfig[]): AppPluginConfig[] {
  const pluginIds = [
    // The "cloud-home-app" is registering banners once it's loaded, and this can cause a rerender in the AppChrome if it's loaded after the Grafana app init.
    'cloud-home-app',
  ];

  return apps.filter((app) => pluginIds.includes(app.id));
}

/**
 * Returns a list of app plugins that has to be preloaded in parallel with the core Grafana initialization.
 * @param apps - The app plugin configs.
 * @returns An array of app plugin configs that has to be preloaded in parallel with the core Grafana initialization.
 */
export function getAppPluginsToPreloadSync(apps: AppPluginConfig[]): AppPluginConfig[] {
  // The DashboardPanelMenu extension point is using the `getPluginExtensions()` API in scenes at the moment, which means that it cannot yet benefit from dynamic plugin loading.
  const dashboardPanelMenuPluginIds = getExtensionPointPluginDependenciesSync(
    PluginExtensionPoints.DashboardPanelMenu,
    apps
  );
  const awaitedPluginIds = getAppPluginsToAwaitSync(apps).map((app) => app.id);
  const isNotAwaited = (app: AppPluginConfig) => !awaitedPluginIds.includes(app.id);

  return apps.filter((app) => {
    return isNotAwaited(app) && (app.preload || dashboardPanelMenuPluginIds.includes(app.id));
  });
}
