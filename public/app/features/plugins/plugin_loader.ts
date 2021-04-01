import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment'; // eslint-disable-line no-restricted-imports
import angular from 'angular';
import jquery from 'jquery';

// Experimental module exports
import prismjs from 'prismjs';
import slate from 'slate';
// @ts-ignore
import slateReact from '@grafana/slate-react';
// @ts-ignore
import slatePlain from 'slate-plain-serializer';
import react from 'react';
import reactDom from 'react-dom';
import * as reactRedux from 'react-redux';
import * as redux from 'redux';

import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import TableModel from 'app/core/table_model';
import { coreModule, appEvents, contextSrv } from 'app/core/core';
import * as flatten from 'app/core/utils/flatten';
import * as ticks from 'app/core/utils/ticks';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';
import impressionSrv from 'app/core/services/impression_srv';
import builtInPlugins from './built_in_plugins';
import * as d3 from 'd3';
import * as emotion from '@emotion/css';
import * as grafanaData from '@grafana/data';
import * as grafanaUIraw from '@grafana/ui';
import * as grafanaRuntime from '@grafana/runtime';

import { getPanelPluginNotFound, getPanelPluginLoadError } from '../dashboard/dashgrid/PanelPluginError';
import { GenericDataSourcePlugin } from '../datasources/settings/PluginSettings';

// rxjs
import * as rxjs from 'rxjs';
import * as rxjsOperators from 'rxjs/operators';

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import 'vendor/flot/jquery.flot.gauge';

const { SystemJS } = grafanaRuntime;

// Help the 6.4 to 6.5 migration
// The base classes were moved from @grafana/ui to @grafana/data
// This exposes the same classes on both import paths
const grafanaUI = grafanaUIraw as any;
grafanaUI.PanelPlugin = grafanaData.PanelPlugin;
grafanaUI.DataSourcePlugin = grafanaData.DataSourcePlugin;
grafanaUI.AppPlugin = grafanaData.AppPlugin;
grafanaUI.DataSourceApi = grafanaData.DataSourceApi;

const PLUGIN_BASE_URL = '/public';

interface ImportMapModule {
  key: string;
  path: string;
}

const appendImportMap = (modules: ImportMapModule[], reprocessImportMaps: boolean): Promise<HTMLScriptElement> => {
  const script = document.createElement('script');
  script.type = 'systemjs-importmap';
  script.textContent = JSON.stringify({
    imports: Object.fromEntries(modules.map(({ key, path }) => [key, path])),
  });

  // Tests don't support `document.currentScript`
  document.body.append(script);

  // Wait for import map
  return SystemJS.prepareImport(reprocessImportMaps).then(() => script);
};

// Exported for tests
export interface ExposedModuleConfig {
  isPluginModule?: boolean;
  key: string;
  path?: string; // @todo remove?
  url?: string; // @todo remove?
  value: any;
}

// Exported for tests
export interface CompleteExposedModuleConfig {
  isPluginModule: boolean;
  key: string;
  path: string;
  url: string;
  value: any;
}

// Exported for tests
export interface ExposedModulesConfig {
  importMap: HTMLScriptElement;
  modules: CompleteExposedModuleConfig[];
}

const cacheBuster = Date.now();

const resolveModulePath = (key: string, isPluginModule = false): string => {
  if (isPluginModule) {
    const baseURL = key.startsWith('/') ? '' : `${PLUGIN_BASE_URL}/`;
    const defaultExtension = key.endsWith('.js') ? '' : '.js';
    return `${baseURL}${key}${defaultExtension}?_cache=${cacheBuster}`;
  } else {
    return `${PLUGIN_BASE_URL}/nonexistent-for-import-map/${key}/index.js`;
  }
};

// Exported for tests
export const exposeAsyncModules = async (
  modules: ExposedModuleConfig[],
  reloadImportMaps = false
): Promise<ExposedModulesConfig> => {
  const TEMP_URL = '__temp';

  const semiCompleteModules = modules.map(
    ({ isPluginModule, key, path, url, value }) =>
      ({
        isPluginModule: !!isPluginModule,
        key,
        path: path ?? resolveModulePath(key, isPluginModule),
        url: url ?? TEMP_URL,
        value: value ?? {}, // support undefined named exports within test stubs
      } as CompleteExposedModuleConfig)
  );

  const script = await appendImportMap(semiCompleteModules, reloadImportMaps);

  // `SystemJS.resolve` failed if `SystemJS.prepareImport` was not called
  const completeModules = semiCompleteModules.map(
    (module) =>
      ({
        ...module,
        url: module.url === TEMP_URL ? SystemJS.resolve(module.key) : module.url,
      } as CompleteExposedModuleConfig)
  );

  completeModules.forEach(({ url, value }) => SystemJS.set(url, value));

  return {
    importMap: script,
    modules: completeModules,
  };
};

const flotDeps = [
  'jquery.flot',
  'jquery.flot.pie',
  'jquery.flot.time',
  'jquery.flot.fillbelow',
  'jquery.flot.crosshair',
  'jquery.flot.stack',
  'jquery.flot.selection',
  'jquery.flot.stackpercent',
  'jquery.flot.events',
  'jquery.flot.gauge',
];

exposeAsyncModules([
  { key: '@grafana/data', value: grafanaData },
  { key: '@grafana/ui', value: grafanaUI },
  { key: '@grafana/runtime', value: grafanaRuntime },
  { key: 'lodash', value: _ },
  { key: 'moment', value: moment },
  { key: 'jquery', value: jquery },
  { key: 'angular', value: angular },
  { key: 'd3', value: d3 },
  { key: 'rxjs', value: rxjs },
  { key: 'rxjs/operators', value: rxjsOperators },

  // Experimental modules
  { key: 'prismjs', value: prismjs },
  { key: 'slate', value: slate },
  { key: '@grafana/slate-react', value: slateReact },
  { key: 'slate-plain-serializer', value: slatePlain },
  { key: 'react', value: react },
  { key: 'react-dom', value: reactDom },
  { key: 'react-redux', value: reactRedux },
  { key: 'redux', value: redux },
  { key: 'emotion', value: emotion },

  { key: 'app/features/dashboard/impression_store', value: { impressions: impressionSrv } },

  /**
   * NOTE: this is added temporarily while we explore a long term solution
   * If you use this export, only use the:
   *  get/delete/post/patch/request methods
   */
  {
    key: 'app/core/services/backend_srv',
    value: {
      BackendSrv,
      getBackendSrv,
    },
  },

  { key: 'app/plugins/sdk', value: sdk },
  { key: 'app/core/utils/datemath', value: grafanaData.dateMath },
  { key: 'app/core/utils/flatten', value: flatten },
  { key: 'app/core/utils/kbn', value: kbn },
  { key: 'app/core/utils/ticks', value: ticks },
  { key: 'app/core/utils/promiseToDigest', value: { promiseToDigest } },

  { key: 'app/core/config', value: config },
  { key: 'app/core/time_series', value: TimeSeries },
  { key: 'app/core/time_series2', value: TimeSeries },
  { key: 'app/core/table_model', value: TableModel },
  { key: 'app/core/app_events', value: appEvents },
  { key: 'app/core/core_module', value: coreModule },
  {
    key: 'app/core/core',
    value: {
      coreModule,
      appEvents,
      contextSrv,
    },
  },

  ...flotDeps.map((flotDep) => ({ key: flotDep, value: { fakeDep: 1 } })),
]);

export async function importPluginModule(path: string): Promise<any> {
  const builtIn = builtInPlugins[path];
  if (builtIn) {
    // for handling dynamic imports
    if (typeof builtIn === 'function') {
      return await builtIn();
    } else {
      return Promise.resolve(builtIn);
    }
  }

  return SystemJS.import(resolveModulePath(path, true));
}

export function importDataSourcePlugin(meta: grafanaData.DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return importPluginModule(meta.module).then((pluginExports) => {
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
  return importPluginModule(meta.module).then((pluginExports) => {
    const plugin = pluginExports.plugin ? (pluginExports.plugin as grafanaData.AppPlugin) : new grafanaData.AppPlugin();
    plugin.init(meta);
    plugin.meta = meta;
    plugin.setComponentsFromLegacyExports(pluginExports);
    return plugin;
  });
}

interface PanelCache {
  [key: string]: Promise<grafanaData.PanelPlugin>;
}
const panelCache: PanelCache = {};

export function importPanelPlugin(id: string): Promise<grafanaData.PanelPlugin> {
  const loaded = panelCache[id];

  if (loaded) {
    return loaded;
  }

  const meta = config.panels[id];

  if (!meta) {
    return Promise.resolve(getPanelPluginNotFound(id));
  }

  panelCache[id] = importPluginModule(meta.module)
    .then((pluginExports) => {
      if (pluginExports.plugin) {
        return pluginExports.plugin as grafanaData.PanelPlugin;
      } else if (pluginExports.PanelCtrl) {
        const plugin = new grafanaData.PanelPlugin(null);
        plugin.angularPanelCtrl = pluginExports.PanelCtrl;
        return plugin;
      }
      throw new Error('missing export: plugin or PanelCtrl');
    })
    .then((plugin) => {
      plugin.meta = meta;
      return plugin;
    })
    .catch((err) => {
      // TODO, maybe a different error plugin
      console.warn('Error loading panel plugin: ' + id, err);
      return getPanelPluginLoadError(meta, err);
    });

  return panelCache[id];
}
