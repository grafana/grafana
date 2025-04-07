import {
  AppPlugin,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  PluginLoadingStrategy,
  PluginMeta,
  throwIfAngular,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { getI18next } from 'app/core/internationalization';
import { DEFAULT_LANGUAGE } from 'app/core/internationalization/constants';

import { GenericDataSourcePlugin } from '../datasources/types';

import builtInPlugins from './built_in_plugins';
import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
} from './extensions/registry/setup';
import { getPluginFromCache, registerPluginInCache } from './loader/cache';
// SystemJS has to be imported before the sharedDependenciesMap
import { SystemJS } from './loader/systemjs';
// eslint-disable-next-line import/order
import { sharedDependenciesMap } from './loader/sharedDependencies';
import { decorateSystemJSFetch, decorateSystemJSResolve, decorateSystemJsOnload } from './loader/systemjsHooks';
import { SystemJSWithLoaderHooks } from './loader/types';
import { buildImportMap, resolveModulePath } from './loader/utils';
import { importPluginModuleInSandbox } from './sandbox/sandbox_plugin_loader';
import { shouldLoadPluginInFrontendSandbox } from './sandbox/sandbox_plugin_loader_registry';
import { pluginsLogger } from './utils';

const imports = buildImportMap(sharedDependenciesMap);

SystemJS.addImportMap({ imports });

const systemJSPrototype: SystemJSWithLoaderHooks = SystemJS.constructor.prototype;

// This instructs SystemJS to load plugin assets using fetch and eval if it returns a truthy value, otherwise
// it will load the plugin using a script tag. The logic that sets loadingStrategy comes from the backend.
// See: pkg/services/pluginsintegration/pluginassets/pluginassets.go
systemJSPrototype.shouldFetch = function (url) {
  const pluginInfo = getPluginFromCache(url);
  const jsTypeRegEx = /^[^#?]+\.(js)([?#].*)?$/;

  if (!jsTypeRegEx.test(url)) {
    return true;
  }

  return Boolean(pluginInfo?.loadingStrategy !== PluginLoadingStrategy.script);
};

const originalImport = systemJSPrototype.import;
// Hook Systemjs import to support plugins that only have a default export.
systemJSPrototype.import = function (...args: Parameters<typeof originalImport>) {
  return originalImport.apply(this, args).then((module) => {
    if (module && module.__useDefault) {
      return module.default;
    }
    return module;
  });
};

const systemJSFetch = systemJSPrototype.fetch;
systemJSPrototype.fetch = function (url: string, options?: Record<string, unknown>) {
  return decorateSystemJSFetch(systemJSFetch, url, options);
};

const systemJSResolve = systemJSPrototype.resolve;
systemJSPrototype.resolve = decorateSystemJSResolve.bind(systemJSPrototype, systemJSResolve);

// Older plugins load .css files which resolves to a CSS Module.
// https://github.com/WICG/webcomponents/blob/gh-pages/proposals/css-modules-v1-explainer.md#importing-a-css-module
// Any css files loaded via SystemJS have their styles applied onload.
systemJSPrototype.onload = decorateSystemJsOnload;

type PluginImportInfo = {
  path: string;
  pluginId: string;
  loadingStrategy: PluginLoadingStrategy;
  version?: string;
  moduleHash?: string;
  translations?: Record<string, string>;
};

export async function importPluginModule({
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
      resolvedLanguage: getI18next().resolvedLanguage ?? DEFAULT_LANGUAGE,
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

export function importDataSourcePlugin(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  throwIfAngular(meta);

  const fallbackLoadingStrategy = meta.loadingStrategy ?? PluginLoadingStrategy.fetch;
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    loadingStrategy: fallbackLoadingStrategy,
    pluginId: meta.id,
    moduleHash: meta.moduleHash,
    translations: meta.translations,
  }).then((pluginExports) => {
    if (pluginExports.plugin) {
      const dsPlugin: GenericDataSourcePlugin = pluginExports.plugin;
      dsPlugin.meta = meta;
      return dsPlugin;
    }
    if (pluginExports.Datasource) {
      const dsPlugin = new DataSourcePlugin<
        DataSourceApi<DataQuery, DataSourceJsonData>,
        DataQuery,
        DataSourceJsonData
      >(pluginExports.Datasource);
      dsPlugin.setComponentsFromLegacyExports(pluginExports);
      dsPlugin.meta = meta;
      return dsPlugin;
    }

    throw new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export');
  });
}

// Only successfully loaded plugins are cached
const importedAppPlugins: Record<string, AppPlugin> = {};

export async function importAppPlugin(meta: PluginMeta): Promise<AppPlugin> {
  const pluginId = meta.id;

  if (importedAppPlugins[pluginId]) {
    return importedAppPlugins[pluginId];
  }

  throwIfAngular(meta);

  const pluginExports = await importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    pluginId: meta.id,
    loadingStrategy: meta.loadingStrategy ?? PluginLoadingStrategy.fetch,
    moduleHash: meta.moduleHash,
    translations: meta.translations,
  });

  const { plugin = new AppPlugin() } = pluginExports;
  plugin.init(meta);
  plugin.meta = meta;
  plugin.setComponentsFromLegacyExports(pluginExports);

  exposedComponentsRegistry.register({
    pluginId,
    configs: plugin.exposedComponentConfigs || [],
  });
  addedComponentsRegistry.register({
    pluginId,
    configs: plugin.addedComponentConfigs || [],
  });
  addedLinksRegistry.register({
    pluginId,
    configs: plugin.addedLinkConfigs || [],
  });
  addedFunctionsRegistry.register({
    pluginId,
    configs: plugin.addedFunctionConfigs || [],
  });

  importedAppPlugins[pluginId] = plugin;

  return plugin;
}

interface AddTranslationsToI18nOptions {
  resolvedLanguage: string;
  fallbackLanguage: string;
  pluginId: string;
  translations: Record<string, string>;
}

// exported for testing purposes only
export async function addTranslationsToI18n({
  resolvedLanguage,
  fallbackLanguage,
  pluginId,
  translations,
}: AddTranslationsToI18nOptions): Promise<void> {
  const resolvedPath = translations[resolvedLanguage];
  const fallbackPath = translations[fallbackLanguage];
  const path = resolvedPath ?? fallbackPath;

  if (!path) {
    console.warn(`Could not find any translation for plugin ${pluginId}`, { resolvedLanguage, fallbackLanguage });
    return;
  }

  try {
    const module = await SystemJS.import(resolveModulePath(path));
    if (!module.default) {
      console.warn(`Could not find default export for plugin ${pluginId}`, {
        resolvedLanguage,
        fallbackLanguage,
        path,
      });
      return;
    }

    const language = resolvedPath ? resolvedLanguage : fallbackLanguage;
    getI18next().addResourceBundle(language, pluginId, module.default, undefined, true);
  } catch (error) {
    console.warn(`Could not load translation for plugin ${pluginId}`, {
      resolvedLanguage,
      fallbackLanguage,
      error,
      path,
    });
  }
}
