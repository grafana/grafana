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

import { GenericDataSourcePlugin } from '../datasources/types';

import {
  addedComponentsRegistry,
  addedFunctionsRegistry,
  addedLinksRegistry,
  exposedComponentsRegistry,
} from './extensions/registry/setup';
import { importPluginModule } from './importer/importPluginModule';
import { pluginImporter } from './importer/pluginImporter';
import { getPluginFromCache } from './loader/cache';
// SystemJS has to be imported before the sharedDependenciesMap
import { SystemJS } from './loader/systemjs';
// eslint-disable-next-line import/order
import { sharedDependenciesMap } from './loader/sharedDependencies';
import { decorateSystemJSFetch, decorateSystemJSResolve, decorateSystemJsOnload } from './loader/systemjsHooks';
import { SystemJSWithLoaderHooks } from './loader/types';
import { buildImportMap } from './loader/utils';

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

export function importDataSourcePlugin(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  if (config.featureToggles.enablePluginImporter) {
    return pluginImporter.importDataSource(meta);
  }

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

// Cache for import promises to prevent duplicate imports
const importPromises: Record<string, Promise<AppPlugin>> = {};

export async function importAppPlugin(meta: PluginMeta): Promise<AppPlugin> {
  if (config.featureToggles.enablePluginImporter) {
    return pluginImporter.importApp(meta);
  }

  const pluginId = meta.id;

  // We are caching the import promises to prevent duplicate imports
  if (importPromises[pluginId] === undefined) {
    importPromises[pluginId] = doImportAppPlugin(meta);
  }

  return importPromises[pluginId];
}

async function doImportAppPlugin(meta: PluginMeta): Promise<AppPlugin> {
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
    pluginId: meta.id,
    configs: plugin.exposedComponentConfigs || [],
  });
  addedComponentsRegistry.register({
    pluginId: meta.id,
    configs: plugin.addedComponentConfigs || [],
  });
  addedLinksRegistry.register({
    pluginId: meta.id,
    configs: plugin.addedLinkConfigs || [],
  });
  addedFunctionsRegistry.register({
    pluginId: meta.id,
    configs: plugin.addedFunctionConfigs || [],
  });

  return plugin;
}
