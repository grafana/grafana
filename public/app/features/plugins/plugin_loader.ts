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
import {
  DataSourcePlugin,
  AppPlugin,
  PanelPlugin,
  PluginMeta,
  DataSourcePluginMeta,
  dateMath,
  DataSourceApi,
  DataSourceJsonData,
  DataQuery,
} from '@grafana/data';
import * as fileExport from 'app/core/utils/file_export';
import * as flatten from 'app/core/utils/flatten';
import * as ticks from 'app/core/utils/ticks';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import builtInPlugins from './built_in_plugins';
import * as d3 from 'd3';
import * as emotion from 'emotion';
import * as grafanaData from '@grafana/data';
import * as grafanaUIraw from '@grafana/ui';
import * as grafanaRuntime from '@grafana/runtime';

// Help the 6.4 to 6.5 migration
// The base classes were moved from @grafana/ui to @grafana/data
// This exposes the same classes on both import paths
const grafanaUI = grafanaUIraw as any;
grafanaUI.PanelPlugin = grafanaData.PanelPlugin;
grafanaUI.DataSourcePlugin = grafanaData.DataSourcePlugin;
grafanaUI.AppPlugin = grafanaData.AppPlugin;
grafanaUI.DataSourceApi = grafanaData.DataSourceApi;

// rxjs
import * as rxjs from 'rxjs';
import * as rxjsOperators from 'rxjs/operators';

// add cache busting
const bust = `?_cache=${Date.now()}`;
function locate(load: { address: string }) {
  return load.address + bust;
}
grafanaRuntime.SystemJS.registry.set('plugin-loader', grafanaRuntime.SystemJS.newModule({ locate: locate }));

grafanaRuntime.SystemJS.config({
  baseURL: 'public',
  defaultExtension: 'js',
  packages: {
    plugins: {
      defaultExtension: 'js',
    },
  },
  map: {
    text: 'vendor/plugin-text/text.js',
    css: 'vendor/plugin-css/css.js',
  },
  meta: {
    '/*': {
      esModule: true,
      authorization: true,
      loader: 'plugin-loader',
    },
  },
});

function exposeToPlugin(name: string, component: any) {
  grafanaRuntime.SystemJS.registerDynamic(name, [], true, (require: any, exports: any, module: { exports: any }) => {
    module.exports = component;
  });
}

exposeToPlugin('@grafana/data', grafanaData);
exposeToPlugin('@grafana/ui', grafanaUI);
exposeToPlugin('@grafana/runtime', grafanaRuntime);
exposeToPlugin('lodash', _);
exposeToPlugin('moment', moment);
exposeToPlugin('jquery', jquery);
exposeToPlugin('angular', angular);
exposeToPlugin('d3', d3);
exposeToPlugin('rxjs', rxjs);
exposeToPlugin('rxjs/operators', rxjsOperators);

// Experimental modules
exposeToPlugin('prismjs', prismjs);
exposeToPlugin('slate', slate);
exposeToPlugin('@grafana/slate-react', slateReact);
exposeToPlugin('slate-plain-serializer', slatePlain);
exposeToPlugin('react', react);
exposeToPlugin('react-dom', reactDom);
exposeToPlugin('react-redux', reactRedux);
exposeToPlugin('redux', redux);
exposeToPlugin('emotion', emotion);

exposeToPlugin('app/features/dashboard/impression_store', {
  impressions: impressionSrv,
  __esModule: true,
});

/**
 * NOTE: this is added temporarily while we explore a long term solution
 * If you use this export, only use the:
 *  get/delete/post/patch/request methods
 */
exposeToPlugin('app/core/services/backend_srv', {
  BackendSrv,
  getBackendSrv,
});

exposeToPlugin('app/plugins/sdk', sdk);
exposeToPlugin('app/core/utils/datemath', dateMath);
exposeToPlugin('app/core/utils/file_export', fileExport);
exposeToPlugin('app/core/utils/flatten', flatten);
exposeToPlugin('app/core/utils/kbn', kbn);
exposeToPlugin('app/core/utils/ticks', ticks);

exposeToPlugin('app/core/config', config);
exposeToPlugin('app/core/time_series', TimeSeries);
exposeToPlugin('app/core/time_series2', TimeSeries);
exposeToPlugin('app/core/table_model', TableModel);
exposeToPlugin('app/core/app_events', appEvents);
exposeToPlugin('app/core/core_module', coreModule);
exposeToPlugin('app/core/core', {
  coreModule: coreModule,
  appEvents: appEvents,
  contextSrv: contextSrv,
  __esModule: true,
});

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import 'vendor/flot/jquery.flot.gauge';

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

for (const flotDep of flotDeps) {
  exposeToPlugin(flotDep, { fakeDep: 1 });
}

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
  return grafanaRuntime.SystemJS.import(path);
}

export function importDataSourcePlugin(meta: DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return importPluginModule(meta.module).then(pluginExports => {
    if (pluginExports.plugin) {
      const dsPlugin = pluginExports.plugin as GenericDataSourcePlugin;
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
  return importPluginModule(meta.module).then(pluginExports => {
    const plugin = pluginExports.plugin ? (pluginExports.plugin as AppPlugin) : new AppPlugin();
    plugin.init(meta);
    plugin.meta = meta;
    plugin.setComponentsFromLegacyExports(pluginExports);
    return plugin;
  });
}

import { getPanelPluginNotFound, getPanelPluginLoadError } from '../dashboard/dashgrid/PanelPluginError';
import { GenericDataSourcePlugin } from '../datasources/settings/PluginSettings';

interface PanelCache {
  [key: string]: Promise<PanelPlugin>;
}
const panelCache: PanelCache = {};

export function importPanelPlugin(id: string): Promise<PanelPlugin> {
  const loaded = panelCache[id];

  if (loaded) {
    return loaded;
  }

  const meta = config.panels[id];

  if (!meta) {
    return Promise.resolve(getPanelPluginNotFound(id));
  }

  panelCache[id] = importPluginModule(meta.module)
    .then(pluginExports => {
      if (pluginExports.plugin) {
        return pluginExports.plugin as PanelPlugin;
      } else if (pluginExports.PanelCtrl) {
        const plugin = new PanelPlugin(null);
        plugin.angularPanelCtrl = pluginExports.PanelCtrl;
        return plugin;
      }
      throw new Error('missing export: plugin or PanelCtrl');
    })
    .then(plugin => {
      plugin.meta = meta;
      return plugin;
    })
    .catch(err => {
      // TODO, maybe a different error plugin
      console.warn('Error loading panel plugin: ' + id, err);
      return getPanelPluginLoadError(meta, err);
    });

  return panelCache[id];
}
