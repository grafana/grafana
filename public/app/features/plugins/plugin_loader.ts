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
import * as reactRouter from 'react-router-dom';
import * as redux from 'redux';
import * as rxjs from 'rxjs';
import * as rxjsOperators from 'rxjs/operators';
import slate from 'slate';
import slatePlain from 'slate-plain-serializer';
import slateReact from 'slate-react';

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
import { availableCompartmentDependenciesMap, importPluginInsideSandbox } from './sandbox/sandbox_plugin_loader';
import { locateFromCDN, translateForCDN } from './systemjsPlugins/pluginCDN';
import { fetchCSS, locateCSS } from './systemjsPlugins/pluginCSS';
import { locateWithCache, registerPluginInCache } from './systemjsPlugins/pluginCacheBuster';

// Help the 6.4 to 6.5 migration
// The base classes were moved from @grafana/ui to @grafana/data
// This exposes the same classes on both import paths
const grafanaUI = grafanaUIraw as any;
grafanaUI.PanelPlugin = grafanaData.PanelPlugin;
grafanaUI.DataSourcePlugin = grafanaData.DataSourcePlugin;
grafanaUI.AppPlugin = grafanaData.AppPlugin;
grafanaUI.DataSourceApi = grafanaData.DataSourceApi;

grafanaRuntime.SystemJS.registry.set('css', grafanaRuntime.SystemJS.newModule({ locate: locateCSS, fetch: fetchCSS }));
grafanaRuntime.SystemJS.registry.set('plugin-loader', grafanaRuntime.SystemJS.newModule({ locate: locateWithCache }));
grafanaRuntime.SystemJS.registry.set(
  'cdn-loader',
  grafanaRuntime.SystemJS.newModule({ locate: locateFromCDN, translate: translateForCDN })
);

grafanaRuntime.SystemJS.config({
  baseURL: 'public',
  defaultExtension: 'js',
  packages: {
    plugins: {
      defaultExtension: 'js',
    },
    'plugin-cdn': {
      defaultExtension: 'js',
    },
  },
  map: {
    text: 'vendor/plugin-text/text.js',
  },
  meta: {
    '/*': {
      esModule: true,
      authorization: true,
      loader: 'plugin-loader',
    },
    '*.css': {
      loader: 'css',
    },
    'plugin-cdn/*': {
      esModule: true,
      authorization: false,
      loader: 'cdn-loader',
    },
  },
});

export function exposeToPlugin(name: string, component: any) {
  availableCompartmentDependenciesMap.set(name, component);
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
exposeToPlugin('d3', d3);
exposeToPlugin('rxjs', rxjs);
exposeToPlugin('rxjs/operators', rxjsOperators);
exposeToPlugin('react-router-dom', reactRouter);

// Experimental modules
exposeToPlugin('prismjs', prismjs);
exposeToPlugin('slate', slate);
exposeToPlugin('slate-react', slateReact);
exposeToPlugin('@grafana/slate-react', slateReact); // for backwards compatibility with older plugins
exposeToPlugin('slate-plain-serializer', slatePlain);
exposeToPlugin('react', react);
exposeToPlugin('react-dom', reactDom);
exposeToPlugin('react-redux', reactRedux);
exposeToPlugin('redux', redux);
exposeToPlugin('emotion', emotion);
exposeToPlugin('@emotion/css', emotion);
exposeToPlugin('@emotion/react', emotionReact);

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

exposeToPlugin('app/core/utils/datemath', grafanaData.dateMath);
exposeToPlugin('app/core/utils/flatten', flatten);
exposeToPlugin('app/core/utils/kbn', kbn);
exposeToPlugin('app/core/utils/ticks', ticks);
exposeToPlugin('app/core/config', config);
exposeToPlugin('app/core/time_series', TimeSeries);
exposeToPlugin('app/core/time_series2', TimeSeries);
exposeToPlugin('app/core/table_model', TableModel);
exposeToPlugin('app/core/app_events', appEvents);
exposeToPlugin('app/core/core', {
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

const nearMembranePOCPluginList = [
  'marcusolsson-json-datasource',
  'sespoc',
  'marcusolsson-dynamictext-panel',
  'myorg-extensions-app',
  'grafana-polystat-panel',
];

export async function importPluginModule(path: string, version?: string): Promise<any> {
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

  // if path contains any string in nearMembranePOCPluginList, load it via compartments
  if (nearMembranePOCPluginList.some((pluginName) => path.includes(pluginName))) {
    return importPluginInsideSandbox(path);
  }

  return grafanaRuntime.SystemJS.import(path);
}

export function importDataSourcePlugin(meta: grafanaData.DataSourcePluginMeta): Promise<GenericDataSourcePlugin> {
  return importPluginModule(meta.module, meta.info?.version).then((pluginExports) => {
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
  return importPluginModule(meta.module, meta.info?.version).then((pluginExports) => {
    const plugin = pluginExports.plugin ? (pluginExports.plugin as grafanaData.AppPlugin) : new grafanaData.AppPlugin();
    plugin.init(meta);
    plugin.meta = meta;
    plugin.setComponentsFromLegacyExports(pluginExports);
    return plugin;
  });
}
