import 'symbol-observable';
import 'core-js';
import 'regenerator-runtime/runtime';

import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import './polyfills/old-mediaquerylist'; // Safari < 14 does not have mql.addEventListener()
import 'file-saver';
import 'jquery';

// eslint-disable-next-line lodash/import-scope
import _ from 'lodash';
import ReactDOM from 'react-dom';
import React from 'react';
import config from 'app/core/config';
// @ts-ignore ignoring this for now, otherwise we would have to extend _ interface with move
import {
  locationUtil,
  monacoLanguageRegistry,
  setLocale,
  setTimeZoneResolver,
  setWeekStart,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  standardTransformersRegistry,
} from '@grafana/data';
import { arrayMove } from 'app/core/utils/arrayMove';
import { preloadPlugins } from './features/plugins/pluginPreloader';
import {
  locationService,
  registerEchoBackend,
  setBackendSrv,
  setDataSourceSrv,
  setEchoSrv,
  setLocationSrv,
  setQueryRunnerFactory,
} from '@grafana/runtime';
import { Echo } from './core/services/echo/Echo';
import { reportPerformance } from './core/services/echo/EchoSrv';
import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
import 'app/features/all';
import { getScrollbarWidth, getStandardFieldConfigs } from '@grafana/ui';
import { variableAdapters } from './features/variables/adapters';
import { initDevFeatures } from './dev';
import { getStandardTransformers } from 'app/core/utils/standardTransformers';
import { SentryEchoBackend } from './core/services/echo/backends/sentry/SentryBackend';
import { setVariableQueryRunner, VariableQueryRunner } from './features/variables/query/VariableQueryRunner';
import { configureStore } from './store/configureStore';
import { AppWrapper } from './AppWrapper';
import { interceptLinkClicks } from './core/navigation/patch/interceptLinkClicks';
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
import { backendSrv } from './core/services/backend_srv';
import { setPanelRenderer } from '@grafana/runtime/src/components/PanelRenderer';
import { PanelDataErrorView } from './features/panel/components/PanelDataErrorView';
import { setPanelDataErrorView } from '@grafana/runtime/src/components/PanelDataErrorView';
import { DatasourceSrv } from './features/plugins/datasource_srv';
import { AngularApp } from './angular';
import { ModalManager } from './core/services/ModalManager';
import { initWindowRuntime } from './features/runtime/init';
import { createQueryVariableAdapter } from './features/variables/query/adapter';
import { createCustomVariableAdapter } from './features/variables/custom/adapter';
import { createTextBoxVariableAdapter } from './features/variables/textbox/adapter';
import { createConstantVariableAdapter } from './features/variables/constant/adapter';
import { createDataSourceVariableAdapter } from './features/variables/datasource/adapter';
import { createIntervalVariableAdapter } from './features/variables/interval/adapter';
import { createAdHocVariableAdapter } from './features/variables/adhoc/adapter';
import { createSystemVariableAdapter } from './features/variables/system/adapter';

// add move to lodash for backward compatabilty with plugins
// @ts-ignore
_.move = arrayMove;

// import symlinked extensions
const extensionsIndex = (require as any).context('.', true, /extensions\/index.ts/);
const extensionsExports = extensionsIndex.keys().map((key: any) => {
  return extensionsIndex(key);
});

if (process.env.NODE_ENV === 'development') {
  initDevFeatures();
}

export class GrafanaApp {
  angularApp: AngularApp;

  constructor() {
    this.angularApp = new AngularApp();
  }

  async init() {
    try {
      setBackendSrv(backendSrv);
      initEchoSrv();
      addClassIfNoOverlayScrollbar();
      setLocale(config.bootData.user.locale);
      setWeekStart(config.bootData.user.weekStart);
      setPanelRenderer(PanelRenderer);
      setPanelDataErrorView(PanelDataErrorView);
      setLocationSrv(locationService);
      setTimeZoneResolver(() => config.bootData.user.timezone);
      // Important that extension reducers are initialized before store
      addExtensionReducers();
      configureStore();
      initExtensions();

      standardEditorsRegistry.setInit(getAllOptionEditors);
      standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
      standardTransformersRegistry.setInit(getStandardTransformers);
      variableAdapters.setInit(() => [
        createQueryVariableAdapter(),
        createCustomVariableAdapter(),
        createTextBoxVariableAdapter(),
        createConstantVariableAdapter(),
        createDataSourceVariableAdapter(),
        createIntervalVariableAdapter(),
        createAdHocVariableAdapter(),
        createSystemVariableAdapter(),
      ]);
      monacoLanguageRegistry.setInit(getDefaultMonacoLanguages);

      setQueryRunnerFactory(() => new QueryRunner());
      setVariableQueryRunner(new VariableQueryRunner());

      locationUtil.initialize({
        config,
        getTimeRangeForUrl: getTimeSrv().timeRangeForUrl,
        getVariablesUrlParams: getVariablesUrlParams,
      });

      // intercept anchor clicks and forward it to custom history instead of relying on browser's history
      document.addEventListener('click', interceptLinkClicks);

      // Init DataSourceSrv
      const dataSourceSrv = new DatasourceSrv();
      dataSourceSrv.init(config.datasources, config.defaultDatasource);
      setDataSourceSrv(dataSourceSrv);
      initWindowRuntime();

      // init modal manager
      const modalManager = new ModalManager();
      modalManager.init();

      // Init angular
      this.angularApp.init();

      // Preload selected app plugins
      await preloadPlugins(config.pluginsToPreload);

      ReactDOM.render(
        React.createElement(AppWrapper, {
          app: this,
        }),
        document.getElementById('reactRoot')
      );
    } catch (error: any) {
      console.error('Failed to start Grafana', error);
      window.__grafana_load_failed();
    }
  }
}

function addExtensionReducers() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].addExtensionReducers();
  }
}

function initExtensions() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].init();
  }
}

function initEchoSrv() {
  setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));

  window.addEventListener('load', (e) => {
    const loadMetricName = 'frontend_boot_load_time_seconds';
    // Metrics below are marked in public/views/index-template.html
    const jsLoadMetricName = 'frontend_boot_js_done_time_seconds';
    const cssLoadMetricName = 'frontend_boot_css_time_seconds';

    if (performance) {
      performance.mark(loadMetricName);
      reportMetricPerformanceMark('first-paint', 'frontend_boot_', '_time_seconds');
      reportMetricPerformanceMark('first-contentful-paint', 'frontend_boot_', '_time_seconds');
      reportMetricPerformanceMark(loadMetricName);
      reportMetricPerformanceMark(jsLoadMetricName);
      reportMetricPerformanceMark(cssLoadMetricName);
    }
  });

  if (contextSrv.user.orgRole !== '') {
    registerEchoBackend(new PerformanceBackend({}));
  }

  if (config.sentry.enabled) {
    registerEchoBackend(
      new SentryEchoBackend({
        ...config.sentry,
        user: config.bootData.user,
        buildInfo: config.buildInfo,
      })
    );
  }

  if ((config as any).googleAnalyticsId) {
    registerEchoBackend(
      new GAEchoBackend({
        googleAnalyticsId: (config as any).googleAnalyticsId,
      })
    );
  }

  if ((config as any).rudderstackWriteKey && (config as any).rudderstackDataPlaneUrl) {
    registerEchoBackend(
      new RudderstackBackend({
        writeKey: (config as any).rudderstackWriteKey,
        dataPlaneUrl: (config as any).rudderstackDataPlaneUrl,
        user: config.bootData.user,
        sdkUrl: (config as any).rudderstackSdkUrl,
        configUrl: (config as any).rudderstackConfigUrl,
      })
    );
  }

  if (config.applicationInsightsConnectionString) {
    registerEchoBackend(
      new ApplicationInsightsBackend({
        connectionString: config.applicationInsightsConnectionString,
        endpointUrl: config.applicationInsightsEndpointUrl,
      })
    );
  }
}

function addClassIfNoOverlayScrollbar() {
  if (getScrollbarWidth() > 0) {
    document.body.classList.add('no-overlay-scrollbar');
  }
}

/**
 * Report when a metric of a given name was marked during the document lifecycle. Works for markers with no duration,
 * like PerformanceMark or PerformancePaintTiming (e.g. created with performance.mark, or first-contentful-paint)
 */
function reportMetricPerformanceMark(metricName: string, prefix = '', suffix = ''): void {
  const metric = _.first(performance.getEntriesByName(metricName));
  if (metric) {
    const metricName = metric.name.replace(/-/g, '_');
    reportPerformance(`${prefix}${metricName}${suffix}`, Math.round(metric.startTime) / 1000);
  }
}

export default new GrafanaApp();
