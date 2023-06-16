import * as emotion from '@emotion/css';
import * as emotionReact from '@emotion/react';
import * as d3 from 'd3';
import jquery from 'jquery';
import _ from 'lodash'; // eslint-disable-line lodash/import-scope
import moment from 'moment'; // eslint-disable-line no-restricted-imports
import prismjs from 'prismjs';
import react from 'react';
import reactDom from 'react-dom';
import * as reactRedux from 'react-redux'; // eslint-disable-line no-restricted-imports
import * as reactRouterDom from 'react-router-dom';
import * as reactRouterCompat from 'react-router-dom-v5-compat';
import * as redux from 'redux';
import * as rxjs from 'rxjs';
import * as rxjsOperators from 'rxjs/operators';
import slate from 'slate';
import slatePlain from 'slate-plain-serializer';
import slateReact from 'slate-react';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import 'vendor/flot/jquery.flot.gauge';

import * as grafanaData from '@grafana/data';
import * as grafanaRuntime from '@grafana/runtime';
import * as grafanaUIraw from '@grafana/ui';
import TableModel from 'app/core/TableModel';
import config from 'app/core/config';
import { appEvents, contextSrv } from 'app/core/core';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import TimeSeries from 'app/core/time_series2';
import * as flatten from 'app/core/utils/flatten';
import kbn from 'app/core/utils/kbn';
import * as ticks from 'app/core/utils/ticks';

import { GenericDataSourcePlugin } from '../datasources/types';

import builtInPlugins from './built_in_plugins';
import { PLUGIN_CDN_URL_KEY } from './constants';
import { sandboxPluginDependencies } from './sandbox/plugin_dependencies';
import { importPluginModuleInSandbox } from './sandbox/sandbox_plugin_loader';
import { locateWithCache2, registerPluginInCache } from './systemjsPlugins/pluginCacheBuster';

// Help the 6.4 to 6.5 migration
// The base classes were moved from @grafana/ui to @grafana/data
// This exposes the same classes on both import paths
const grafanaUI = grafanaUIraw as Record<string, unknown>;
grafanaUI.PanelPlugin = grafanaData.PanelPlugin;
grafanaUI.DataSourcePlugin = grafanaData.DataSourcePlugin;
grafanaUI.AppPlugin = grafanaData.AppPlugin;
grafanaUI.DataSourceApi = grafanaData.DataSourceApi;

const { SystemJS } = grafanaRuntime;

const jQueryFlotDeps = [
  'jquery.flot.crosshair',
  'jquery.flot.events',
  'jquery.flot.fillbelow',
  'jquery.flot.gauge',
  'jquery.flot.pie',
  'jquery.flot.selection',
  'jquery.flot.stack',
  'jquery.flot.stackpercent',
  'jquery.flot.time',
  'jquery.flot',
].reduce((acc, flotDep) => ({ ...acc, [flotDep]: { fakeDep: 1 } }), {});

const importMap = {
  '@emotion/css': emotion,
  '@emotion/react': emotionReact,
  '@grafana/data': grafanaData,
  '@grafana/runtime': grafanaRuntime,
  '@grafana/slate-react': slateReact, // for backwards compatibility with older plugins
  '@grafana/ui': grafanaUI,
  'app/core/app_events': {
    default: appEvents,
    __useDefault: true,
  },
  'app/core/config': {
    default: config,
    __useDefault: true,
  },
  'app/core/core': {
    appEvents: appEvents,
    contextSrv: contextSrv,
  },
  'app/core/services/backend_srv': {
    BackendSrv,
    getBackendSrv,
  },
  'app/core/table_model': { default: TableModel, __useDefault: true },
  'app/core/time_series': { default: TimeSeries, __useDefault: true },
  'app/core/time_series2': { default: TimeSeries, __useDefault: true },
  'app/core/utils/datemath': grafanaData.dateMath,
  'app/core/utils/flatten': flatten,
  'app/core/utils/kbn': kbn,
  'app/core/utils/ticks': ticks,
  'app/features/dashboard/impression_store': {
    impressions: impressionSrv,
  },
  d3: d3,
  emotion: emotion,
  jquery: {
    default: jquery,
    __useDefault: true,
  },
  ...jQueryFlotDeps,
  lodash: _,
  moment: {
    default: moment,
    __useDefault: true,
  },
  prismjs: prismjs,
  react: react,
  'react-dom': reactDom,
  'react-redux': reactRedux,
  // Migration - React Router v5 -> v6
  // =================================
  // Plugins that still use "react-router-dom@v5" don't depend on react-router directly, so they will not use this import.
  // (The react-router-dom@v5 that we expose for them depends on the "react-router" package internally from core.)
  //
  // Plugins that would like update to "react-router-dom@v6" will need to bundle "react-router-dom",
  // however they cannot bundle "react-router" - this would mean that we have two instances of "react-router"
  // in the app, which would casue issues. As the "react-router-dom-v5-compat" package re-exports everything from "react-router-dom@v6"
  // which then re-exports everything from "react-router@v6", we are in the lucky state to be able to expose a compatible v6 version of the router to plugins by
  // just exposing "react-router-dom-v5-compat".
  //
  // (This means that we are exposing two versions of the same package).
  'react-router-dom': reactRouterDom, // react-router-dom@v5
  'react-router': reactRouterCompat, // react-router-dom@v6, react-router@v6 (included)
  redux: redux,
  rxjs: rxjs,
  'rxjs/operators': rxjsOperators,
  slate: slate,
  'slate-plain-serializer': slatePlain,
  'slate-react': slateReact,
} as Record<string, System.Module>;

export function buildImportMap(importMap: Record<string, System.Module>) {
  return Object.keys(importMap).reduce((acc, key) => {
    // Use the 'app:' prefix to act as a URL instead of a bare specifier
    const module_name = `app:${key}`;
    // expose dependency to SystemJS
    SystemJS.set(module_name, importMap[key]);

    // expose dependency to sandboxed plugins
    sandboxPluginDependencies.set(key, importMap[key]);

    acc[key] = module_name;
    return acc;
  }, {} as Record<string, string>);
}

const imports = buildImportMap(importMap);

// pass the map of module names so systemjs can resolve them
// to the imports above.
SystemJS.addImportMap({ imports });

const moduleTypesRegEx = /^[^#?]+\.(css|html|json|wasm)([?#].*)?$/;
const loadPluginCssRegEx = /^plugins.+\.css$/i;
const jsContentTypeRegEx = /^text\/javascript(;|$)/;

// Fetch and eval if assest is not JS or loading from CDN
// otherwise we load via script for performance and security goodness!
SystemJS.shouldFetch = function (url: string) {
  const isHostedAtCDN = Boolean(config.pluginsCDNBaseURL) && url.startsWith(config.pluginsCDNBaseURL);
  const isNotJS = moduleTypesRegEx.test(url);

  return isNotJS || isHostedAtCDN;
};

const systemJSPrototype = SystemJS.constructor.prototype;
const systemJSFetch = systemJSPrototype.fetch;

systemJSPrototype.fetch = function (url: string, options: Record<string, unknown>) {
  return systemJSFetch(url, options).then(async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    // JS files on the CDN need their asset paths transformed in the source
    if (jsContentTypeRegEx.test(contentType) && res.url.startsWith(config.pluginsCDNBaseURL)) {
      const source = await res.text();
      const splitUrl = res.url.split('/public/plugins/');
      const baseAddress = splitUrl[0];
      const pluginId = splitUrl[1].split('/')[0];
      const transformedSrc = jsPluginCDNTransform(source, baseAddress, pluginId);
      return new Response(new Blob([transformedSrc], { type: 'text/javascript' }));
    }
    return res;
  });
};

const originalResolve = systemJSPrototype.resolve;

systemJSPrototype.resolve = function (id: string, parentUrl: string) {
  const isHostedAtCDN = Boolean(config.pluginsCDNBaseURL) && id.startsWith(config.pluginsCDNBaseURL);
  // CDN paths are unique as they contain the version in the path
  const shouldUseQueryCache = id.endsWith('module.js') && !isHostedAtCDN;
  const cachedId = shouldUseQueryCache ? locateWithCache2(id) : id;
  // console.log('SystemJS resolve hook:', { id, parentUrl, cachedId }, arguments);
  try {
    return originalResolve.apply(this, [cachedId, parentUrl]);
  } catch (err) {
    if (loadPluginCssRegEx.test(id)) {
      return patchLoadPluginCssUrl(id);
    }
    console.log(`SystemJS: failed to resolve '${id}'`);
    return id;
  }
};

// For backwards compatiblity with older plugins that use `loadPluginCss`
// we need to translate the path for systemjs 6.x.x to understand
const patchLoadPluginCssUrl = (id: string) => `./public/${id}`;

// TODO: this should replace translateForCDN from './systemjsPlugins/pluginCDN'
function jsPluginCDNTransform(source: string, baseAddress: string, pluginId: string) {
  let transformedSrc = source;
  transformedSrc = transformedSrc.replace(/(\/?)(public\/plugins)/g, `${baseAddress}/$2`);
  transformedSrc = transformedSrc.replace(/(["|'])(plugins\/.+?.css)(["|'])/g, `$1${baseAddress}/public/$2$3`);
  // TODO: SystemJS 6 already does this transform, do we need it for sandbox?
  transformedSrc = transformedSrc.replace(
    /(\/\/#\ssourceMappingURL=)(.+)\.map/g,
    `$1${baseAddress}/public/plugins/${pluginId}/$2.map`
  );
  return transformedSrc;
}

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
}): Promise<any> {
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

export function importDataSourcePlugin(meta: grafanaData.DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    isAngular: meta.angularDetected,
    pluginId: meta.id,
  }).then((pluginExports) => {
    if (pluginExports.plugin) {
      const dsPlugin = pluginExports.plugin as GenericDataSourcePlugin;
      dsPlugin.meta = meta;
      return dsPlugin;
    }

    if (pluginExports.Datasource) {
      const dsPlugin = new grafanaData.DataSourcePlugin<
        grafanaData.DataSourceApi<grafanaData.DataQuery, grafanaData.DataSourceJsonData>,
        grafanaData.DataQuery,
        grafanaData.DataSourceJsonData
      >(pluginExports.Datasource);
      dsPlugin.setComponentsFromLegacyExports(pluginExports);
      dsPlugin.meta = meta;
      return dsPlugin;
    }

    throw new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export');
  });
}

export function importAppPlugin(meta: grafanaData.PluginMeta): Promise<grafanaData.AppPlugin> {
  return importPluginModule({
    path: meta.module,
    version: meta.info?.version,
    isAngular: meta.angularDetected,
    pluginId: meta.id,
  }).then((pluginExports) => {
    const plugin = pluginExports.plugin ? (pluginExports.plugin as grafanaData.AppPlugin) : new grafanaData.AppPlugin();
    plugin.init(meta);
    plugin.meta = meta;
    plugin.setComponentsFromLegacyExports(pluginExports);
    return plugin;
  });
}
