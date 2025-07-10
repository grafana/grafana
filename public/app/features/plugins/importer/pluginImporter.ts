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
  PluginType,
  throwIfAngular,
} from '@grafana/data';
import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { getResolvedLanguage } from '@grafana/i18n/internal';
import { config } from '@grafana/runtime';
import { GenericDataSourcePlugin } from 'app/features/datasources/types';
import { getPanelPluginLoadError } from 'app/features/panel/components/PanelPluginError';

import builtInPlugins from '../built_in_plugins';
import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
} from '../extensions/registry/setup';
import { registerPluginInCache } from '../loader/cache';
import { SystemJS } from '../loader/systemjs';
import { resolveModulePath } from '../loader/utils';
import { importPluginModuleInSandbox } from '../sandbox/sandboxPluginLoader';
import { shouldLoadPluginInFrontendSandbox } from '../sandbox/sandboxPluginLoaderRegistry';
import { pluginsLogger } from '../utils';

import { addTranslationsToI18n } from './addTranslationsToI18n';
import { PluginImportInfo, PostImportStrategy, PreImportStrategy } from './types';

async function importPluginModule({
  path,
  pluginId,
  loadingStrategy,
  version,
  moduleHash,
  translations,
}: PluginImportInfo): Promise<System.Module> {
  if (version) {
    registerPluginInCache({ path, version, loadingStrategy });
  }

  // Add locales to i18n for a plugin if the feature toggle is enabled and the plugin has locales
  if (config.featureToggles.localizationForPlugins && translations) {
    await addTranslationsToI18n({
      resolvedLanguage: getResolvedLanguage(),
      fallbackLanguage: DEFAULT_LANGUAGE,
      pluginId,
      translations,
    });
  }

  const builtIn = builtInPlugins[path];
  if (builtIn) {
    // for handling dynamic imports
    if (typeof builtIn === 'function') {
      return await builtIn();
    } else {
      return builtIn;
    }
  }

  const modulePath = resolveModulePath(path);

  // inject integrity hash into SystemJS import map
  if (config.featureToggles.pluginsSriChecks) {
    const resolvedModule = System.resolve(modulePath);
    const integrityMap = System.getImportMap().integrity;

    if (moduleHash && integrityMap && !integrityMap[resolvedModule]) {
      SystemJS.addImportMap({
        integrity: {
          [resolvedModule]: moduleHash,
        },
      });
    }
  }

  // the sandboxing environment code cannot work in nodejs and requires a real browser
  if (await shouldLoadPluginInFrontendSandbox({ pluginId })) {
    return importPluginModuleInSandbox({ pluginId });
  }

  return SystemJS.import(modulePath).catch((e) => {
    let error = new Error('Could not load plugin: ' + e);
    console.error(error);
    pluginsLogger.logError(error, {
      path,
      pluginId,
      pluginVersion: version ?? '',
      expectedHash: moduleHash ?? '',
      loadingStrategy: loadingStrategy.toString(),
      sriChecksEnabled: (config.featureToggles.pluginsSriChecks ?? false).toString(),
    });
    throw error;
  });
}

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
      panelPluginCache.set(meta.id, plugin);
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
    return dsPlugin;
  }

  if (pluginExports.Datasource) {
    const dsPlugin = new DataSourcePlugin<DataSourceApi<DataQuery, DataSourceJsonData>, DataQuery, DataSourceJsonData>(
      pluginExports.Datasource
    );
    dsPlugin.setComponentsFromLegacyExports(pluginExports);
    dsPlugin.meta = meta;
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

  return plugin;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPreImportStrategy = (plugin: PluginMeta): PreImportStrategy<any> => defaultPreImport;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPostImportStrategy = (plugin: PluginMeta): PostImportStrategy<any, any> => {
  if (plugin.type === PluginType.panel) {
    return panelPluginPostImport;
  }

  if (plugin.type === PluginType.datasource) {
    return datasourcePluginPostImport;
  }

  if (plugin.type === PluginType.app) {
    return appPluginPostImport;
  }

  return (meta: PluginMeta, module: Promise<System.Module>) => Promise.resolve(module);
};

const panelPluginCache: Map<string, PanelPlugin> = new Map();
const promisesCache: Map<string, Promise<GrafanaPlugin>> = new Map();

const getPluginPromiseFromCache = <M extends PluginMeta = PluginMeta, P extends GrafanaPlugin<M> = GrafanaPlugin<M>>(
  meta: M
): Promise<P> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cached: any = promisesCache.get(meta.id);
  if (cached) {
    return cached;
  }

  throw new Error(`Trying to get unknown plugin from cache`);
};

const importPlugin = async <M extends PluginMeta = PluginMeta, P extends GrafanaPlugin<M> = GrafanaPlugin<M>>(
  meta: M
): Promise<P> => {
  if (promisesCache.has(meta.id)) {
    return getPluginPromiseFromCache(meta);
  }

  const args = getPreImportStrategy(meta)(meta);
  const module = importPluginModule(args);
  const plugin = getPostImportStrategy(meta)(meta, module);
  promisesCache.set(meta.id, plugin);

  return getPluginPromiseFromCache<M, P>(meta);
};

const importer = {
  importPanelPlugin: (plugin: PanelPluginMeta): Promise<PanelPlugin> => importPlugin(plugin),
  importDatasourcePlugin: (plugin: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> => importPlugin(plugin),
  importAppPlugin: (plugin: AppPluginMeta): Promise<AppPlugin> => importPlugin(plugin),
  getPanelPlugin: (id: string) => panelPluginCache.get(id),
};

export const pluginImporter = () => importer;
