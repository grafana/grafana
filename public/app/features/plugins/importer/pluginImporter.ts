import {
  AppPlugin,
  AppPluginMeta,
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  GrafanaPlugin,
  PanelPlugin,
  PanelPluginMeta,
  PluginLoadingStrategy,
  PluginMeta,
  throwIfAngular,
} from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/types';
import { getPanelPluginLoadError } from 'app/features/panel/components/PanelPluginError';

import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
} from '../extensions/registry/setup';

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

const panelPluginPostImport: PostImportStrategy<PanelPluginMeta, PanelPlugin> = async (meta, module) => {
  return module
    .then((pluginExports) => {
      if (pluginExports.plugin) {
        return pluginExports.plugin;
      }

      throwIfAngular(pluginExports);
      throw new Error('missing export: plugin');
    })
    .then((plugin: PanelPlugin) => {
      plugin.meta = meta;
      pluginsCache.set(meta.id, plugin);
      return plugin;
    })
    .catch((err) => {
      // TODO, maybe a different error plugin
      console.warn('Error loading panel plugin: ' + meta.id, err);
      return getPanelPluginLoadError(meta, err);
    });
};

const datasourcePluginPostImport: PostImportStrategy<DataSourcePluginMeta, GenericDataSourcePlugin> = async (
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

const appPluginPostImport: PostImportStrategy<AppPluginMeta, AppPlugin> = async (meta, module) => {
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

const promisesCache: Map<string, Promise<unknown>> = new Map();

const getPromiseFromCache = <M extends PluginMeta, P extends GrafanaPlugin<M>>(meta: M): Promise<P> => {
  const cached = promisesCache.get(meta.id);
  if (cached) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cached as Promise<P>;
  }

  throw new Error(`Trying to get unknown plugin type ${meta.type} from cache for plugin ${meta.id}`);
};

const pluginsCache: Map<string, unknown> = new Map();

const getPluginFromCache = <P extends PanelPlugin | GenericDataSourcePlugin | AppPlugin>(id: string): P | undefined => {
  const cached = pluginsCache.get(id);
  // TODO: investigate if we can get this from the SystemJS registry instead?
  if (cached) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cached as P;
  }

  return undefined;
};

const importPlugin = <M extends PluginMeta, P extends GrafanaPlugin<M>>(
  meta: M,
  postImportStrategy: PostImportStrategy<M, P>,
  preImportStrategy: PreImportStrategy<M> = defaultPreImport
): Promise<P> => {
  if (promisesCache.has(meta.id)) {
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
  getPanelPlugin: (id: string) => getPluginFromCache<PanelPlugin>(id),
};
