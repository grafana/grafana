var e_1, _a;
import { __awaiter, __generator, __values } from "tslib";
// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment'; // eslint-disable-line no-restricted-imports
import angular from 'angular';
import jquery from 'jquery';
import * as tslib from 'tslib';
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
// Help the 6.4 to 6.5 migration
// The base classes were moved from @grafana/ui to @grafana/data
// This exposes the same classes on both import paths
var grafanaUI = grafanaUIraw;
grafanaUI.PanelPlugin = grafanaData.PanelPlugin;
grafanaUI.DataSourcePlugin = grafanaData.DataSourcePlugin;
grafanaUI.AppPlugin = grafanaData.AppPlugin;
grafanaUI.DataSourceApi = grafanaData.DataSourceApi;
// rxjs
import * as rxjs from 'rxjs';
import * as rxjsOperators from 'rxjs/operators';
// routing
import * as reactRouter from 'react-router-dom';
// add cache busting
var bust = "?_cache=" + Date.now();
function locate(load) {
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
function exposeToPlugin(name, component) {
    grafanaRuntime.SystemJS.registerDynamic(name, [], true, function (require, exports, module) {
        module.exports = component;
    });
}
exposeToPlugin('tslib', tslib);
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
exposeToPlugin('react-router-dom', reactRouter);
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
exposeToPlugin('@emotion/css', emotion);
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
    BackendSrv: BackendSrv,
    getBackendSrv: getBackendSrv,
});
exposeToPlugin('app/plugins/sdk', sdk);
exposeToPlugin('app/core/utils/datemath', grafanaData.dateMath);
exposeToPlugin('app/core/utils/flatten', flatten);
exposeToPlugin('app/core/utils/kbn', kbn);
exposeToPlugin('app/core/utils/ticks', ticks);
exposeToPlugin('app/core/utils/promiseToDigest', {
    promiseToDigest: promiseToDigest,
    __esModule: true,
});
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
var flotDeps = [
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
try {
    for (var flotDeps_1 = __values(flotDeps), flotDeps_1_1 = flotDeps_1.next(); !flotDeps_1_1.done; flotDeps_1_1 = flotDeps_1.next()) {
        var flotDep = flotDeps_1_1.value;
        exposeToPlugin(flotDep, { fakeDep: 1 });
    }
}
catch (e_1_1) { e_1 = { error: e_1_1 }; }
finally {
    try {
        if (flotDeps_1_1 && !flotDeps_1_1.done && (_a = flotDeps_1.return)) _a.call(flotDeps_1);
    }
    finally { if (e_1) throw e_1.error; }
}
export function importPluginModule(path) {
    return __awaiter(this, void 0, void 0, function () {
        var builtIn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    builtIn = builtInPlugins[path];
                    if (!builtIn) return [3 /*break*/, 3];
                    if (!(typeof builtIn === 'function')) return [3 /*break*/, 2];
                    return [4 /*yield*/, builtIn()];
                case 1: return [2 /*return*/, _a.sent()];
                case 2: return [2 /*return*/, Promise.resolve(builtIn)];
                case 3: return [2 /*return*/, grafanaRuntime.SystemJS.import(path)];
            }
        });
    });
}
export function importDataSourcePlugin(meta) {
    return importPluginModule(meta.module).then(function (pluginExports) {
        if (pluginExports.plugin) {
            var dsPlugin = pluginExports.plugin;
            dsPlugin.meta = meta;
            return dsPlugin;
        }
        if (pluginExports.Datasource) {
            var dsPlugin = new grafanaData.DataSourcePlugin(pluginExports.Datasource);
            dsPlugin.setComponentsFromLegacyExports(pluginExports);
            dsPlugin.meta = meta;
            return dsPlugin;
        }
        throw new Error('Plugin module is missing DataSourcePlugin or Datasource constructor export');
    });
}
export function importAppPlugin(meta) {
    return importPluginModule(meta.module).then(function (pluginExports) {
        var plugin = pluginExports.plugin ? pluginExports.plugin : new grafanaData.AppPlugin();
        plugin.init(meta);
        plugin.meta = meta;
        plugin.setComponentsFromLegacyExports(pluginExports);
        return plugin;
    });
}
//# sourceMappingURL=plugin_loader.js.map