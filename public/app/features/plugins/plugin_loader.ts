import {
  AppPlugin,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  PluginLoadingStrategy,
  PluginMeta,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { GenericDataSourcePlugin } from '../datasources/types';

import builtInPlugins from './built_in_plugins';
import { getPluginFromCache, registerPluginInCache } from './loader/cache';
// SystemJS has to be imported before the sharedDependenciesMap
import { SystemJS } from './loader/systemjs';
// eslint-disable-next-line import/order
import { sharedDependenciesMap } from './loader/sharedDependencies';
import { decorateSystemJSFetch, decorateSystemJSResolve, decorateSystemJsOnload } from './loader/systemjsHooks';
import { SystemJSWithLoaderHooks } from './loader/types';
import { buildImportMap, resolveModulePath } from './loader/utils';
import { importPluginModuleInSandbox } from './sandbox/sandbox_plugin_loader';
import { isFrontendSandboxSupported } from './sandbox/utils';
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

export async function importPluginModule({
  path,
  pluginId,
  loadingStrategy,
  version,
  isAngular,
  moduleHash,
}: {
  path: string;
  pluginId: string;
  loadingStrategy: PluginLoadingStrategy;
  version?: string;
  isAngular?: boolean;
  moduleHash?: string;
}): Promise<System.Module> {
  if (version) {
    registerPluginInCache({ path, version, loadingStrategy });
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
  if (await isFrontendSandboxSupported({ isAngular, pluginId })) {
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
  const isAngular = meta.angular?.detected ?? meta.angularDetected;
  const fallbackLoadingStrategy = meta.loadingStrategy ?? PluginLoadingStrategy.fetch;
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    isAngular,
    loadingStrategy: fallbackLoadingStrategy,
    pluginId: meta.id,
    moduleHash: meta.moduleHash,
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

export function importAppPlugin(meta: PluginMeta): Promise<AppPlugin> {
  const isAngular = meta.angular?.detected ?? meta.angularDetected;
  const fallbackLoadingStrategy = meta.loadingStrategy ?? PluginLoadingStrategy.fetch;
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    isAngular,
    loadingStrategy: fallbackLoadingStrategy,
    pluginId: meta.id,
    moduleHash: meta.moduleHash,
  }).then((pluginExports) => {
    const plugin: AppPlugin = pluginExports.plugin ? pluginExports.plugin : new AppPlugin();
    plugin.init(meta);
    plugin.meta = meta;
    plugin.setComponentsFromLegacyExports(pluginExports);
    return plugin;
  });
}
