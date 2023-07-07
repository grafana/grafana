import {
  AppPlugin,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  PluginMeta,
} from '@grafana/data';
import { SystemJS, config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { GenericDataSourcePlugin } from '../datasources/types';

import builtInPlugins from './built_in_plugins';
import { transformPluginSourceForCDN } from './cdn/utils';
import { registerPluginInCache, resolveWithCache } from './loader/cache';
import { LOAD_PLUGIN_CSS_REGEX, JS_CONTENT_TYPE_REGEX, IS_SYSTEM_MODULE_REGEX } from './loader/constants';
import { sharedDependenciesMap } from './loader/sharedDependencies';
import { buildImportMap, getBackWardsCompatibleUrl, preventAMDLoaderCollision } from './loader/utils';
import { importPluginModuleInSandbox } from './sandbox/sandbox_plugin_loader';

const imports = buildImportMap(sharedDependenciesMap);
SystemJS.addImportMap({ imports });

const systemJSPrototype = SystemJS.constructor.prototype;
const systemJSFetch = systemJSPrototype.fetch;

// Monaco Editors reliance on RequireJS means we need to transform
// the content of the plugin code at runtime which can only be done with fetch/eval.
systemJSPrototype.shouldFetch = () => true;

systemJSPrototype.fetch = function (url: string, options: Record<string, unknown>) {
  return systemJSFetch(url, options).then(async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';

    if (JS_CONTENT_TYPE_REGEX.test(contentType)) {
      const source = await res.text();
      let transformedSrc = source;
      if (!IS_SYSTEM_MODULE_REGEX.test(transformedSrc)) {
        transformedSrc = preventAMDLoaderCollision(source);
      }

      // JS files on the CDN need their asset paths transformed in the source
      if (res.url.startsWith(config.pluginsCDNBaseURL)) {
        const cdnTransformedSrc = transformPluginSourceForCDN({ url: res.url, source: transformedSrc });
        return new Response(new Blob([cdnTransformedSrc], { type: 'text/javascript' }));
      }

      return new Response(new Blob([transformedSrc], { type: 'text/javascript' }));
    }
    return res;
  });
};

const originalResolve = systemJSPrototype.resolve;

systemJSPrototype.resolve = function (id: string, parentUrl: string) {
  const isHostedAtCDN = Boolean(config.pluginsCDNBaseURL) && id.startsWith(config.pluginsCDNBaseURL);
  try {
    let url = originalResolve.apply(this, [id, parentUrl]);
    const cleanedUrl = getBackWardsCompatibleUrl(url);
    // Add a cache query param for filesystem module.js requests
    // CDN hosted plugins contain the version in the path so skip
    const shouldAddCacheQueryParam = cleanedUrl.endsWith('module.js') && !isHostedAtCDN;

    return shouldAddCacheQueryParam ? resolveWithCache(cleanedUrl) : cleanedUrl;
  } catch (err) {
    // Provide fallback for old plugins that use `loadPluginCss` to load theme styles
    if (LOAD_PLUGIN_CSS_REGEX.test(id)) {
      return `/public/${id}`;
    }
    console.log(`SystemJS: failed to resolve '${id}'`);
    return id;
  }
};

// Older plugins load .css files which resolves to a CSS Module.
// https://github.com/WICG/webcomponents/blob/gh-pages/proposals/css-modules-v1-explainer.md#importing-a-css-module
// Any css files loaded via SystemJS have their styles applied onload.
systemJSPrototype.onload = function (err: unknown, id: string, deps: string[], isErrSource: boolean) {
  if (id.endsWith('.css') && !err) {
    const module = SystemJS.get(id);
    const styles = module?.default;
    if (styles) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
    }
  }
};

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

function isFrontendSandboxSupported({ isAngular, pluginId }: { isAngular?: boolean; pluginId: string }): boolean {
  // To fast test and debug the sandbox in the browser.
  const sandboxQueryParam = location.search.includes('nosandbox') && config.buildInfo.env === 'development';
  const isPluginExcepted = config.disableFrontendSandboxForPlugins.includes(pluginId);
  return (
    !isAngular &&
    Boolean(config.featureToggles.pluginsFrontendSandbox) &&
    process.env.NODE_ENV !== 'test' &&
    !isPluginExcepted &&
    !sandboxQueryParam
  );
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
