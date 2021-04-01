import 'symbol-observable';
import 'core-js';
import 'regenerator-runtime/runtime';

import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'; // fetch polyfill needed for PhantomJs rendering

import 'file-saver';
import 'jquery';
import _ from 'lodash';
import ReactDOM from 'react-dom';
import React from 'react';
import config from 'app/core/config';
// @ts-ignore ignoring this for now, otherwise we would have to extend _ interface with move
import {
  locationUtil,
  setLocale,
  setTimeZoneResolver,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  standardTransformersRegistry,
} from '@grafana/data';
import { arrayMove } from 'app/core/utils/arrayMove';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { registerEchoBackend, setEchoSrv, setPanelRenderer, setQueryRunnerFactory } from '@grafana/runtime';
import { Echo } from './core/services/echo/Echo';
import { reportPerformance } from './core/services/echo/EchoSrv';
import { PerformanceBackend } from './core/services/echo/backends/PerformanceBackend';
import 'app/routes/GrafanaCtrl';
import 'app/features/all';
import { getScrollbarWidth, getStandardFieldConfigs, getStandardOptionEditors } from '@grafana/ui';
import { getDefaultVariableAdapters, variableAdapters } from './features/variables/adapters';
import { initDevFeatures } from './dev';
import { getStandardTransformers } from 'app/core/utils/standardTransformers';
import { SentryEchoBackend } from './core/services/echo/backends/sentry/SentryBackend';
import { setVariableQueryRunner, VariableQueryRunner } from './features/variables/query/VariableQueryRunner';
import { configureStore } from './store/configureStore';
import { AppWrapper } from './AppWrapper';
import { interceptLinkClicks } from './core/navigation/patch/interceptLinkClicks';
import { AngularApp } from './angular/AngularApp';
import { PanelRenderer } from './features/panel/PanelRenderer';
import { QueryRunner } from './features/query/state/QueryRunner';
import { getTimeSrv } from './features/dashboard/services/TimeSrv';
import { getVariablesUrlParams } from './features/variables/getAllVariableValuesForUrl';

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

  init() {
    initEchoSrv();
    addClassIfNoOverlayScrollbar();
    setLocale(config.bootData.user.locale);
    setPanelRenderer(PanelRenderer);
    setTimeZoneResolver(() => config.bootData.user.timezone);
    // Important that extensions are initialized before store
    initExtensions();
    configureStore();

    standardEditorsRegistry.setInit(getStandardOptionEditors);
    standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
    standardTransformersRegistry.setInit(getStandardTransformers);
    variableAdapters.setInit(getDefaultVariableAdapters);

    setQueryRunnerFactory(() => new QueryRunner());
    setVariableQueryRunner(new VariableQueryRunner());

    locationUtil.initialize({
      config,
      getTimeRangeForUrl: getTimeSrv().timeRangeForUrl,
      getVariablesUrlParams: getVariablesUrlParams,
    });

    // intercept anchor clicks and forward it to custom history instead of relying on browser's history
    document.addEventListener('click', interceptLinkClicks);

    // disable tool tip animation
    $.fn.tooltip.defaults.animation = false;

    this.angularApp.init();

    // Preload selected app plugins
    const promises = [];
    for (const modulePath of config.pluginsToPreload) {
      promises.push(importPluginModule(modulePath));
    }

    Promise.all(promises).then(() => {
      ReactDOM.render(
        React.createElement(AppWrapper, {
          app: this,
        }),
        document.getElementById('reactRoot')
      );
    });
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
    // Collecting paint metrics first
    if (performance && performance.getEntriesByType) {
      performance.mark('load');

      const paintMetrics = performance.getEntriesByType('paint');

      for (const metric of paintMetrics) {
        reportPerformance(metric.name, Math.round(metric.startTime + metric.duration));
      }

      const loadMetric = performance.getEntriesByName('load')[0];
      reportPerformance(loadMetric.name, Math.round(loadMetric.startTime + loadMetric.duration));
    }
  });

  registerEchoBackend(new PerformanceBackend({}));

  if (config.sentry.enabled) {
    registerEchoBackend(
      new SentryEchoBackend({
        ...config.sentry,
        user: config.bootData.user,
        buildInfo: config.buildInfo,
      })
    );
  }

  window.addEventListener('DOMContentLoaded', () => {
    reportPerformance('dcl', Math.round(performance.now()));
  });
}

function addClassIfNoOverlayScrollbar() {
  if (getScrollbarWidth() > 0) {
    document.body.classList.add('no-overlay-scrollbar');
  }
}

export default new GrafanaApp();
