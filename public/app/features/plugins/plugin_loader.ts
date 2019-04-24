import System from 'systemjs/dist/system.js';
import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment';
import angular from 'angular';
import jquery from 'jquery';

// Experimental module exports
import prismjs from 'prismjs';
import slate from 'slate';
import slateReact from 'slate-react';
import slatePlain from 'slate-plain-serializer';
import react from 'react';
import reactDom from 'react-dom';

import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import TableModel from 'app/core/table_model';
import { coreModule, appEvents, contextSrv } from 'app/core/core';
import { DataSourcePlugin, AppPlugin, ReactPanelPlugin, AngularPanelPlugin, PluginMeta } from '@grafana/ui/src/types';
import * as datemath from 'app/core/utils/datemath';
import * as fileExport from 'app/core/utils/file_export';
import * as flatten from 'app/core/utils/flatten';
import * as ticks from 'app/core/utils/ticks';
import { BackendSrv, getBackendSrv } from 'app/core/services/backend_srv';
import impressionSrv from 'app/core/services/impression_srv';
import builtInPlugins from './built_in_plugins';
import * as d3 from 'd3';
import * as grafanaUI from '@grafana/ui';

// rxjs
import { Observable, Subject } from 'rxjs';

// add cache busting
const bust = `?_cache=${Date.now()}`;
function locate(load) {
  return load.address + bust;
}
System.registry.set('plugin-loader', System.newModule({ locate: locate }));

System.config({
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
  System.registerDynamic(name, [], true, (require, exports, module) => {
    module.exports = component;
  });
}

exposeToPlugin('@grafana/ui', grafanaUI);
exposeToPlugin('lodash', _);
exposeToPlugin('moment', moment);
exposeToPlugin('jquery', jquery);
exposeToPlugin('angular', angular);
exposeToPlugin('d3', d3);
exposeToPlugin('rxjs/Subject', Subject);
exposeToPlugin('rxjs/Observable', Observable);

// Experimental modules
exposeToPlugin('prismjs', prismjs);
exposeToPlugin('slate', slate);
exposeToPlugin('slate-react', slateReact);
exposeToPlugin('slate-plain-serializer', slatePlain);
exposeToPlugin('react', react);
exposeToPlugin('react-dom', reactDom);

// backward compatible path
exposeToPlugin('vendor/npm/rxjs/Rx', {
  Subject: Subject,
  Observable: Observable,
});

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
exposeToPlugin('app/core/utils/datemath', datemath);
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
import 'vendor/flot/jquery.flot.pie';
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

export function importPluginModule(path: string): Promise<any> {
  const builtIn = builtInPlugins[path];
  if (builtIn) {
    return Promise.resolve(builtIn);
  }
  return System.import(path);
}

export function importDataSourcePlugin(path: string): Promise<DataSourcePlugin> {
  return importPluginModule(path).then(pluginExports => {
    if (pluginExports.plugin) {
      return pluginExports.plugin as DataSourcePlugin;
    }

    if (pluginExports.Datasource) {
      const dsPlugin = new DataSourcePlugin(pluginExports.Datasource);
      dsPlugin.setComponentsFromLegacyExports(pluginExports);
      return dsPlugin;
    }

    throw new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export');
  });
}

export function importAppPlugin(meta: PluginMeta): Promise<AppPlugin> {
  return importPluginModule(meta.module).then(pluginExports => {
    return new AppPlugin(meta, pluginExports);
  });
}

export function importPanelPlugin(path: string): Promise<AngularPanelPlugin | ReactPanelPlugin> {
  return importPluginModule(path).then(pluginExports => {
    if (pluginExports.reactPanel) {
      return pluginExports.reactPanel as ReactPanelPlugin;
    } else {
      return new AngularPanelPlugin(pluginExports.PanelCtrl);
    }
  });
}

export function loadPluginCss(options) {
  if (config.bootData.user.lightTheme) {
    System.import(options.light + '!css');
  } else {
    System.import(options.dark + '!css');
  }
}
