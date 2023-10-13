import {
  AppPlugin,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  PluginMeta,
} from '@grafana/data';
import { SystemJS } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { GenericDataSourcePlugin } from '../datasources/types';

import builtInPlugins from './built_in_plugins';
import { registerPluginInCache } from './loader/cache';
import { sharedDependenciesMap } from './loader/sharedDependencies';
import { decorateSystemJSFetch, decorateSystemJSResolve, decorateSystemJsOnload } from './loader/systemjsHooks';
import { SystemJSWithLoaderHooks } from './loader/types';
import { buildImportMap } from './loader/utils';
import { importPluginModuleInSandbox } from './sandbox/sandbox_plugin_loader';
import { isFrontendSandboxSupported } from './sandbox/utils';

const imports = buildImportMap(sharedDependenciesMap);
SystemJS.addImportMap({ imports });

const systemJSPrototype: SystemJSWithLoaderHooks = SystemJS.constructor.prototype;

// Monaco Editors reliance on RequireJS means we need to transform
// the content of the plugin code at runtime which can only be done with fetch/eval.
systemJSPrototype.shouldFetch = () => true;

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
  version,
  isAngular,
  pluginId,
}: {
  path: string;
  pluginId: string;
  version?: string;
  isAngular?: boolean;
}): Promise<System.Module> {
  if (version) {
    registerPluginInCache({ path, version });
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

  // the sandboxing environment code cannot work in nodejs and requires a real browser
  if (isFrontendSandboxSupported({ isAngular, pluginId })) {
    return importPluginModuleInSandbox({ pluginId });
  }

  return SystemJS.import(path);
}

export function importDataSourcePlugin(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    isAngular: meta.angularDetected,
    pluginId: meta.id,
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
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    isAngular: meta.angularDetected,
    pluginId: meta.id,
  }).then((pluginExports) => {
    const plugin: AppPlugin = pluginExports.plugin ? pluginExports.plugin : new AppPlugin();
    plugin.init(meta);
    plugin.meta = meta;
    plugin.setComponentsFromLegacyExports(pluginExports);
    return plugin;
  });
}
