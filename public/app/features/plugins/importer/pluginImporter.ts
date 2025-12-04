import {
  AppPlugin,
  AppPluginMeta,
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  PanelPlugin,
  PanelPluginMeta,
  PluginLoadingStrategy,
  PluginMeta,
  throwIfAngular,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { GenericDataSourcePlugin } from 'app/features/datasources/types';
import { getPanelPluginLoadError } from 'app/features/panel/components/PanelPluginError';
import { PluginReloadedEvent } from 'app/types/events';

import { isBuiltinPluginPath } from '../built_in_plugins';
import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
} from '../extensions/registry/setup';
import { clearPluginInfoInCache } from '../loader/pluginInfoCache';
import { SystemJS } from '../loader/systemjs';
import { resolveModulePath } from '../loader/utils';
import { clearPluginSettingsCache, getPluginSettings } from '../pluginSettings';
import { pluginsLogger, loadPlugin } from '../utils';

import { importPluginModule } from './importPluginModule';
import { PluginImporter, PostImportStrategy, PreImportStrategy } from './types';

const defaultPreImport: PreImportStrategy = (plugin) => {
  throwIfAngular(plugin);
  const fallbackLoadingStrategy = plugin.loadingStrategy ?? PluginLoadingStrategy.fetch;

  const args = {
    path: plugin.module,
    version: plugin.info?.version,
    loadingStrategy: fallbackLoadingStrategy,
    pluginId: plugin.id,
    moduleHash: plugin.moduleHash,
    translations: plugin.translations,
  };

  return args;
};

const panelPluginPostImport: PostImportStrategy<PanelPlugin, PanelPluginMeta> = async (meta, module) => {
  try {
    const pluginExports = await module;

    if (pluginExports.plugin) {
      // pluginExports.plugin can either be a Promise<PanelPlugin> or a PanelPlugin
      const plugin: PanelPlugin = await pluginExports.plugin;
      plugin.meta = meta;
      pluginsCache.set(meta.id, plugin);
      return plugin;
    }

    throwIfAngular(pluginExports);
    throw new Error('missing export: plugin');
  } catch (error) {
    // TODO, maybe a different error plugin
    console.warn('Error loading panel plugin: ' + meta.id, error);
    return getPanelPluginLoadError(meta, error);
  }
};

const datasourcePluginPostImport: PostImportStrategy<GenericDataSourcePlugin, DataSourcePluginMeta> = async (
  meta,
  module
) => {
  const pluginExports = await module;

  if (pluginExports.plugin) {
    const dsPlugin: GenericDataSourcePlugin = pluginExports.plugin;
    dsPlugin.meta = meta;
    pluginsCache.set(meta.id, dsPlugin);
    return dsPlugin;
  }

  if (pluginExports.Datasource) {
    const dsPlugin = new DataSourcePlugin<DataSourceApi<DataQuery, DataSourceJsonData>, DataQuery, DataSourceJsonData>(
      pluginExports.Datasource
    );
    dsPlugin.setComponentsFromLegacyExports(pluginExports);
    dsPlugin.meta = meta;
    pluginsCache.set(meta.id, dsPlugin);
    return dsPlugin;
  }

  throw new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export');
};

const appPluginPostImport: PostImportStrategy<AppPlugin, AppPluginMeta> = async (meta, module) => {
  const pluginExports = await module;

  const { plugin = new AppPlugin() } = pluginExports;
  plugin.init(meta);
  plugin.meta = meta;
  plugin.setComponentsFromLegacyExports(pluginExports);

  exposedComponentsRegistry.register({ pluginId: meta.id, configs: plugin.exposedComponentConfigs || [] });
  addedComponentsRegistry.register({ pluginId: meta.id, configs: plugin.addedComponentConfigs || [] });
  addedLinksRegistry.register({ pluginId: meta.id, configs: plugin.addedLinkConfigs || [] });
  addedFunctionsRegistry.register({ pluginId: meta.id, configs: plugin.addedFunctionConfigs || [] });

  pluginsCache.set(meta.id, plugin);
  return plugin;
};

const promisesCache: Map<string, Promise<PanelPlugin | GenericDataSourcePlugin | AppPlugin>> = new Map();

const getPromiseFromCache = <M extends PluginMeta, P extends PanelPlugin | GenericDataSourcePlugin | AppPlugin>(
  meta: M
): Promise<P> => {
  const cached = promisesCache.get(meta.id);
  if (cached) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cached as Promise<P>;
  }

  throw new Error(`Trying to get unknown plugin type ${meta.type} from cache for plugin ${meta.id}`);
};

const pluginsCache: Map<string, PanelPlugin | GenericDataSourcePlugin | AppPlugin> = new Map();

const getPluginFromCache = <P extends PanelPlugin | GenericDataSourcePlugin | AppPlugin>(id: string): P | undefined => {
  const cached = pluginsCache.get(id);
  if (cached) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cached as P;
  }

  return undefined;
};

const importPlugin = <M extends PluginMeta, P extends PanelPlugin | GenericDataSourcePlugin | AppPlugin>(
  meta: M,
  postImportStrategy: PostImportStrategy<P, M>,
  preImportStrategy: PreImportStrategy<M> = defaultPreImport
): Promise<P> => {
  const cached = getPluginFromCache<P>(meta.id);
  if (cached) {
    pluginsLogger.logDebug(`Retrieving plugin from cache`, {
      path: meta.module,
      pluginId: meta.id,
      pluginVersion: meta.info?.version ?? '',
      expectedHash: meta.moduleHash ?? '',
      loadingStrategy: meta.loadingStrategy ?? PluginLoadingStrategy.fetch,
      sriChecksEnabled: String(Boolean(config.featureToggles.pluginsSriChecks)),
    });
    return Promise.resolve(cached);
  }

  if (promisesCache.has(meta.id)) {
    pluginsLogger.logDebug(`Retrieving plugin from inflight plugin load request`, {
      path: meta.module,
      pluginId: meta.id,
      pluginVersion: meta.info?.version ?? '',
      expectedHash: meta.moduleHash ?? '',
      loadingStrategy: meta.loadingStrategy ?? PluginLoadingStrategy.fetch,
      sriChecksEnabled: String(Boolean(config.featureToggles.pluginsSriChecks)),
    });
    return getPromiseFromCache(meta);
  }

  const args = preImportStrategy(meta);
  const module = importPluginModule(args);
  const plugin = postImportStrategy(meta, module);
  promisesCache.set(meta.id, plugin);

  return getPromiseFromCache(meta);
};

export const pluginImporter: PluginImporter = {
  importPanel: (meta: PanelPluginMeta) => importPlugin(meta, panelPluginPostImport),
  importDataSource: (meta: DataSourcePluginMeta) => importPlugin(meta, datasourcePluginPostImport),
  importApp: (meta: AppPluginMeta) => importPlugin(meta, appPluginPostImport),
  getPanel: (id: string) => getPluginFromCache<PanelPlugin>(id), // we need this sync because how the panel plugins are loaded in PanelRenderer
};

export const clearCaches = () => {
  promisesCache.clear();
  pluginsCache.clear();
};

/**
 * Reloads a plugin by clearing its caches and re-importing it.
 * @param pluginId - The ID of the plugin to reload
 * @returns Promise that resolves when the plugin has been reloaded
 */
export async function reloadPlugin(pluginId: string): Promise<void> {
  pluginsLogger.logDebug(`Reloading plugin`, { pluginId });

  // Get plugin metadata to resolve module path
  const meta = await getPluginSettings(pluginId);

  // Clear plugin from caches
  pluginsCache.delete(pluginId);
  promisesCache.delete(pluginId);

  // Clear plugin settings cache
  clearPluginSettingsCache(pluginId);

  // Clear plugin info cache (used for URL resolution)
  clearPluginInfoInCache(pluginId);

  // Clear SystemJS module cache to force a fresh fetch
  if (!isBuiltinPluginPath(meta.module)) {
    const modulePath = resolveModulePath(meta.module);
    try {
      // Resolve the module path to get the actual URL SystemJS uses
      const resolvedPath = SystemJS.resolve(modulePath);

      // Delete from SystemJS cache - try both the resolved path and original path
      if (SystemJS.has(resolvedPath)) {
        SystemJS.delete(resolvedPath);
        pluginsLogger.logDebug(`Deleted SystemJS cache for resolved path`, { resolvedPath, pluginId });
      }
      if (SystemJS.has(modulePath)) {
        SystemJS.delete(modulePath);
        pluginsLogger.logDebug(`Deleted SystemJS cache for module path`, { modulePath, pluginId });
      }

      // Also try deleting any entries that match the plugin ID
      for (const [key] of SystemJS.entries()) {
        const keyStr = String(key);
        if (keyStr.includes(pluginId) || keyStr.includes(meta.module)) {
          SystemJS.delete(key);
          pluginsLogger.logDebug(`Deleted SystemJS cache entry`, { key: keyStr, pluginId });
        }
      }
    } catch (error) {
      // If resolution fails, try to delete by module path anyway
      pluginsLogger.logDebug(`Could not resolve module path, attempting direct delete`, {
        modulePath,
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (SystemJS.has(modulePath)) {
        SystemJS.delete(modulePath);
      }
    }
  }

  try {
    // Re-import the plugin (this will re-register extensions for app plugins)
    // Note: Extension registries use scan/accumulate, so entries may accumulate on reload.
    // This is acceptable for a reload feature.
    await loadPlugin(pluginId);

    pluginsLogger.logDebug(`Plugin reloaded successfully`, { pluginId });

    // Emit event to notify components that the plugin has been reloaded
    appEvents.publish(new PluginReloadedEvent({ pluginId }));
  } catch (error) {
    pluginsLogger.logError(error instanceof Error ? error : new Error('Failed to reload plugin'), {
      pluginId,
    });
    throw error;
  }
}

function clearWebpackCache(pluginId: string) {
  const pluginNormalisedCacheName = pluginId.replaceAll('-', '_');
  const pluginCacheName = `webpackChunk${pluginNormalisedCacheName}`;

  if (window[pluginCacheName]) {
    // Remove the plugin's webpack cache by name
    delete (window)[pluginCacheName];
  }
}

window.reloadPlugin = async (options: { id: string }) => {
  if (!options?.id) {
    throw new Error('Plugin ID is required');
  }

  clearWebpackCache(options.id);
  return reloadPlugin(options.id);
};
