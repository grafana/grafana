import { __assign, __values } from "tslib";
import 'symbol-observable';
import 'core-js';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'; // fetch polyfill needed for PhantomJs rendering
import './polyfills/old-mediaquerylist'; // Safari < 14 does not have mql.addEventListener()
import 'file-saver';
import 'jquery';
// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import ReactDOM from 'react-dom';
import React from 'react';
import config from 'app/core/config';
// @ts-ignore ignoring this for now, otherwise we would have to extend _ interface with move
import { locationUtil, monacoLanguageRegistry, setLocale, setTimeZoneResolver, setWeekStart, standardEditorsRegistry, standardFieldConfigEditorRegistry, standardTransformersRegistry, } from '@grafana/data';
import { arrayMove } from 'app/core/utils/arrayMove';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { registerEchoBackend, setEchoSrv, setPanelRenderer, setQueryRunnerFactory } from '@grafana/runtime';
import { Echo } from './core/services/echo/Echo';
import { reportPerformance } from './core/services/echo/EchoSrv';
import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
import 'app/routes/GrafanaCtrl';
import 'app/features/all';
import { getScrollbarWidth, getStandardFieldConfigs } from '@grafana/ui';
import { getDefaultVariableAdapters, variableAdapters } from './features/variables/adapters';
import { initDevFeatures } from './dev';
import { getStandardTransformers } from 'app/core/utils/standardTransformers';
import { SentryEchoBackend } from './core/services/echo/backends/sentry/SentryBackend';
import { setVariableQueryRunner, VariableQueryRunner } from './features/variables/query/VariableQueryRunner';
import { configureStore } from './store/configureStore';
import { AppWrapper } from './AppWrapper';
import { interceptLinkClicks } from './core/navigation/patch/interceptLinkClicks';
import { AngularApp } from './angular/AngularApp';
import { PanelRenderer } from './features/panel/components/PanelRenderer';
import { QueryRunner } from './features/query/state/QueryRunner';
import { getTimeSrv } from './features/dashboard/services/TimeSrv';
import { getVariablesUrlParams } from './features/variables/getAllVariableValuesForUrl';
import getDefaultMonacoLanguages from '../lib/monaco-languages';
import { contextSrv } from './core/services/context_srv';
import { GAEchoBackend } from './core/services/echo/backends/analytics/GABackend';
import { ApplicationInsightsBackend } from './core/services/echo/backends/analytics/ApplicationInsightsBackend';
import { RudderstackBackend } from './core/services/echo/backends/analytics/RudderstackBackend';
import { getAllOptionEditors } from './core/components/editors/registry';
// add move to lodash for backward compatabilty with plugins
// @ts-ignore
_.move = arrayMove;
// import symlinked extensions
var extensionsIndex = require.context('.', true, /extensions\/index.ts/);
var extensionsExports = extensionsIndex.keys().map(function (key) {
    return extensionsIndex(key);
});
if (process.env.NODE_ENV === 'development') {
    initDevFeatures();
}
var GrafanaApp = /** @class */ (function () {
    function GrafanaApp() {
        this.angularApp = new AngularApp();
    }
    GrafanaApp.prototype.init = function () {
        var e_1, _a;
        var _this = this;
        initEchoSrv();
        addClassIfNoOverlayScrollbar();
        setLocale(config.bootData.user.locale);
        setWeekStart(config.bootData.user.weekStart);
        setPanelRenderer(PanelRenderer);
        setTimeZoneResolver(function () { return config.bootData.user.timezone; });
        // Important that extensions are initialized before store
        initExtensions();
        configureStore();
        standardEditorsRegistry.setInit(getAllOptionEditors);
        standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
        standardTransformersRegistry.setInit(getStandardTransformers);
        variableAdapters.setInit(getDefaultVariableAdapters);
        monacoLanguageRegistry.setInit(getDefaultMonacoLanguages);
        setQueryRunnerFactory(function () { return new QueryRunner(); });
        setVariableQueryRunner(new VariableQueryRunner());
        locationUtil.initialize({
            config: config,
            getTimeRangeForUrl: getTimeSrv().timeRangeForUrl,
            getVariablesUrlParams: getVariablesUrlParams,
        });
        // intercept anchor clicks and forward it to custom history instead of relying on browser's history
        document.addEventListener('click', interceptLinkClicks);
        // disable tool tip animation
        $.fn.tooltip.defaults.animation = false;
        this.angularApp.init();
        // Preload selected app plugins
        var promises = [];
        try {
            for (var _b = __values(config.pluginsToPreload), _c = _b.next(); !_c.done; _c = _b.next()) {
                var modulePath = _c.value;
                promises.push(importPluginModule(modulePath));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        Promise.all(promises).then(function () {
            ReactDOM.render(React.createElement(AppWrapper, {
                app: _this,
            }), document.getElementById('reactRoot'));
        });
    };
    return GrafanaApp;
}());
export { GrafanaApp };
function initExtensions() {
    if (extensionsExports.length > 0) {
        extensionsExports[0].init();
    }
}
function initEchoSrv() {
    setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));
    window.addEventListener('load', function (e) {
        var e_2, _a;
        var loadMetricName = 'frontend_boot_load_time_seconds';
        if (performance && performance.getEntriesByType) {
            performance.mark(loadMetricName);
            var paintMetrics = performance.getEntriesByType('paint');
            try {
                for (var paintMetrics_1 = __values(paintMetrics), paintMetrics_1_1 = paintMetrics_1.next(); !paintMetrics_1_1.done; paintMetrics_1_1 = paintMetrics_1.next()) {
                    var metric = paintMetrics_1_1.value;
                    reportPerformance("frontend_boot_" + metric.name + "_time_seconds", Math.round(metric.startTime + metric.duration) / 1000);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (paintMetrics_1_1 && !paintMetrics_1_1.done && (_a = paintMetrics_1.return)) _a.call(paintMetrics_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            var loadMetric = performance.getEntriesByName(loadMetricName)[0];
            reportPerformance(loadMetric.name, Math.round(loadMetric.startTime + loadMetric.duration) / 1000);
        }
    });
    if (contextSrv.user.orgRole !== '') {
        registerEchoBackend(new PerformanceBackend({}));
    }
    if (config.sentry.enabled) {
        registerEchoBackend(new SentryEchoBackend(__assign(__assign({}, config.sentry), { user: config.bootData.user, buildInfo: config.buildInfo })));
    }
    if (config.googleAnalyticsId) {
        registerEchoBackend(new GAEchoBackend({
            googleAnalyticsId: config.googleAnalyticsId,
        }));
    }
    if (config.rudderstackWriteKey && config.rudderstackDataPlaneUrl) {
        registerEchoBackend(new RudderstackBackend({
            writeKey: config.rudderstackWriteKey,
            dataPlaneUrl: config.rudderstackDataPlaneUrl,
            user: config.bootData.user,
        }));
    }
    if (config.applicationInsightsConnectionString) {
        registerEchoBackend(new ApplicationInsightsBackend({
            connectionString: config.applicationInsightsConnectionString,
            endpointUrl: config.applicationInsightsEndpointUrl,
        }));
    }
}
function addClassIfNoOverlayScrollbar() {
    if (getScrollbarWidth() > 0) {
        document.body.classList.add('no-overlay-scrollbar');
    }
}
export default new GrafanaApp();
//# sourceMappingURL=app.js.map