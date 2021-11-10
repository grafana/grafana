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
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import {
  locationService,
  registerEchoBackend,
  setBackendSrv,
  setDataSourceSrv,
  setEchoSrv,
  setLocationSrv,
  setPanelRenderer,
  setQueryRunnerFactory,
} from '@grafana/runtime';
import { Echo } from './core/services/echo/Echo';
import { reportPerformance } from './core/services/echo/EchoSrv';
import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
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
import { DatasourceSrv } from './features/plugins/datasource_srv';
import { AngularApp } from './angular';

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
      setLocationSrv(locationService);
      setTimeZoneResolver(() => config.bootData.user.timezone);
      // Important that extensions are initialized before store
      initExtensions();
      configureStore();

      standardEditorsRegistry.setInit(getAllOptionEditors);
      standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
      standardTransformersRegistry.setInit(getStandardTransformers);
      variableAdapters.setInit(getDefaultVariableAdapters);
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

      // Init angular
      this.angularApp.init();

      // Preload selected app plugins
      const promises: Array<Promise<any>> = [];
      for (const modulePath of config.pluginsToPreload) {
        promises.push(importPluginModule(modulePath));
      }

      await Promise.all(promises);

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

function initExtensions() {
  if (extensionsExports.length > 0) {
    extensionsExports[0].init();
  }
}

function initEchoSrv() {
  setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));

  window.addEventListener('load', (e) => {
    const loadMetricName = 'frontend_boot_load_time_seconds';

    if (performance && performance.getEntriesByType) {
      performance.mark(loadMetricName);

      const paintMetrics = performance.getEntriesByType('paint');

      for (const metric of paintMetrics) {
        reportPerformance(
          `frontend_boot_${metric.name}_time_seconds`,
          Math.round(metric.startTime + metric.duration) / 1000
        );
      }

      const loadMetric = performance.getEntriesByName(loadMetricName)[0];
      reportPerformance(loadMetric.name, Math.round(loadMetric.startTime + loadMetric.duration) / 1000);
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

export default new GrafanaApp();
