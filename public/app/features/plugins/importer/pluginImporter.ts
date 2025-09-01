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
import { GenericDataSourcePlugin } from 'app/features/datasources/types';
import { getPanelPluginLoadError } from 'app/features/panel/components/PanelPluginError';

import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
  urlRecognizersRegistry,
} from '../extensions/registry/setup';
import { pluginsLogger } from '../utils';

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
      const plugin: PanelPlugin = pluginExports.plugin;
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
  urlRecognizersRegistry.register({ pluginId: meta.id, configs: plugin.addedUrlRecognizerConfigs || [] });

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
      newPluginLoadingEnabled: String(Boolean(config.featureToggles.enablePluginImporter)),
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
      newPluginLoadingEnabled: String(Boolean(config.featureToggles.enablePluginImporter)),
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
