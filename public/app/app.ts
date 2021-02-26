import 'symbol-observable';
import 'core-js/stable';
import 'regenerator-runtime/runtime';

import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch'; // fetch polyfill needed for PhantomJs rendering
// @ts-ignore
import ttiPolyfill from 'tti-polyfill';

import 'file-saver';
import 'jquery';
import _ from 'lodash';
import angular from 'angular';
import 'angular-route';
import 'angular-sanitize';
import 'angular-bindonce';
import ReactDOM from 'react-dom';
import React from 'react';

import 'vendor/bootstrap/bootstrap';
import 'vendor/angular-other/angular-strap';
import config from 'app/core/config';
// @ts-ignore ignoring this for now, otherwise we would have to extend _ interface with move
import {
  AppEvents,
  setLocale,
  setTimeZoneResolver,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  standardTransformersRegistry,
} from '@grafana/data';
// import { checkBrowserCompatibility } from 'app/core/utils/browser';
import { arrayMove } from 'app/core/utils/arrayMove';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { angularModules } from 'app/core/core_module';
import { appEvents, registerAngularDirectives } from 'app/core/core';
import { locationService, registerEchoBackend, setEchoSrv } from '@grafana/runtime';
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
// TODO[Router]
// import { monkeyPatchInjectorWithPreAssignedBindings } from './core/injectorMonkeyPatch';
import { setVariableQueryRunner, VariableQueryRunner } from './features/variables/query/VariableQueryRunner';
import { configureStore } from './store/configureStore';
import { DashboardLoaderSrv } from './features/dashboard/services/DashboardLoaderSrv';
import { AppWrapper } from './core/AppWrapper';

// Function that patches Angular routing that seems to kick off because of $routeProvider and ng-include usages
// Ref: https://stackoverflow.com/questions/58146221/is-it-possible-to-tamper-client-side-code-in-angular-app
import bridgeReactAngularRouting from './core/navigation/bridgeReactAngularRouting';
import { interceptLinkClicks } from './core/navigation/patch/interceptLinkClicks';
import { CoreEvents } from './types';

// add move to lodash for backward compatabilty with plugins
// @ts-ignore
_.move = arrayMove;

// import symlinked extensions
const extensionsIndex = (require as any).context('.', true, /extensions\/index.ts/);
extensionsIndex.keys().forEach((key: any) => {
  extensionsIndex(key);
});

if (process.env.NODE_ENV === 'development') {
  initDevFeatures();
}

export class GrafanaApp {
  registerFunctions: any;
  ngModuleDependencies: any[];
  preBootModules: any[] | null;

  constructor() {
    this.registerAppEvents();
    this.preBootModules = [];
    this.registerFunctions = {};
    this.ngModuleDependencies = [];
  }

  useModule(module: angular.IModule) {
    if (this.preBootModules) {
      this.preBootModules.push(module);
    } else {
      _.extend(module, this.registerFunctions);
    }
    this.ngModuleDependencies.push(module.name);
    return module;
  }

  init() {
    const app = angular.module('grafana', []);
    addClassIfNoOverlayScrollbar();
    //setViewModeBodyClass(queryStringToJSON(getLocationService().getCurrentLocation().search).kiosk as KioskUrlValue);
    setLocale(config.bootData.user.locale);
    setTimeZoneResolver(() => config.bootData.user.timezone);

    configureStore();
    standardEditorsRegistry.setInit(getStandardOptionEditors);
    standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
    standardTransformersRegistry.setInit(getStandardTransformers);
    variableAdapters.setInit(getDefaultVariableAdapters);

    setVariableQueryRunner(new VariableQueryRunner());

    app.config(
      (
        $controllerProvider: angular.IControllerProvider,
        $compileProvider: angular.ICompileProvider,
        $filterProvider: angular.IFilterProvider,
        $httpProvider: angular.IHttpProvider,
        $provide: angular.auto.IProvideService
      ) => {
        if (config.buildInfo.env !== 'development') {
          $compileProvider.debugInfoEnabled(false);
        }

        $httpProvider.useApplyAsync(true);

        this.registerFunctions.controller = $controllerProvider.register;
        this.registerFunctions.directive = $compileProvider.directive;
        this.registerFunctions.factory = $provide.factory;
        this.registerFunctions.service = $provide.service;
        this.registerFunctions.filter = $filterProvider.register;

        $provide.decorator('$http', [
          '$delegate',
          '$templateCache',
          ($delegate: any, $templateCache: any) => {
            const get = $delegate.get;
            $delegate.get = (url: string, config: any) => {
              if (url.match(/\.html$/)) {
                // some template's already exist in the cache
                if (!$templateCache.get(url)) {
                  url += '?v=' + new Date().getTime();
                }
              }
              return get(url, config);
            };
            return $delegate;
          },
        ]);
      }
    );

    this.ngModuleDependencies = [
      'grafana.core',
      'ngSanitize',
      '$strap.directives',
      'grafana',
      'pasvaz.bindonce',
      'react',
    ];

    // makes it possible to add dynamic stuff
    _.each(angularModules, (m: angular.IModule) => {
      this.useModule(m);
    });

    // register react angular wrappers
    angular.module('grafana.services').service('dashboardLoaderSrv', DashboardLoaderSrv);
    registerAngularDirectives();
    bridgeReactAngularRouting();

    // intercept anchor clicks and forward it to custom history instead of relying on browser's history
    document.addEventListener('click', interceptLinkClicks);

    // disable tool tip animation
    $.fn.tooltip.defaults.animation = false;

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

  registerAppEvents() {
    appEvents.on(CoreEvents.toggleKioskMode, (options: { exit?: boolean }) => {
      if (options && options.exit) {
        locationService.partial({ kiosk: null });
      }

      let kiosk = locationService.getSearch().get('kiosk');

      switch (kiosk) {
        case 'tv':
          kiosk = 'full';
          appEvents.emit(AppEvents.alertSuccess, ['Press ESC to exit Kiosk mode']);
          break;
        case '1':
        case '':
        case 'full':
          kiosk = null;
          break;
        default:
          kiosk = 'tv';
      }

      locationService.partial({ kiosk });
    });
  }

  initEchoSrv() {
    setEchoSrv(new Echo({ debug: process.env.NODE_ENV === 'development' }));

    ttiPolyfill.getFirstConsistentlyInteractive().then((tti: any) => {
      // Collecting paint metrics first
      const paintMetrics = performance && performance.getEntriesByType ? performance.getEntriesByType('paint') : [];

      for (const metric of paintMetrics) {
        reportPerformance(metric.name, Math.round(metric.startTime + metric.duration));
      }
      reportPerformance('tti', tti);
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
}

function addClassIfNoOverlayScrollbar() {
  if (getScrollbarWidth() > 0) {
    document.body.classList.add('no-overlay-scrollbar');
  }
}

export default new GrafanaApp();
