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
import 'react';
import 'react-dom';

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
import appEvents from 'app/core/app_events';
import { checkBrowserCompatibility } from 'app/core/utils/browser';
import { arrayMove } from 'app/core/utils/arrayMove';
import { importPluginModule } from 'app/features/plugins/plugin_loader';
import { angularModules, coreModule } from 'app/core/core_module';
import { registerAngularDirectives } from 'app/core/core';
import { setupAngularRoutes } from 'app/routes/routes';
import { registerEchoBackend, setEchoSrv } from '@grafana/runtime';
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
import { monkeyPatchInjectorWithPreAssignedBindings } from './core/injectorMonkeyPatch';
import { setVariableQueryRunner, VariableQueryRunner } from './features/variables/query/VariableQueryRunner';

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
    setLocale(config.bootData.user.locale);
    setTimeZoneResolver(() => config.bootData.user.timezone);

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
      'ngRoute',
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
    coreModule.config(setupAngularRoutes);
    registerAngularDirectives();

    // disable tool tip animation
    $.fn.tooltip.defaults.animation = false;

    // bootstrap the app
    const injector: any = angular.bootstrap(document, this.ngModuleDependencies);

    injector.invoke(() => {
      _.each(this.preBootModules, (module: angular.IModule) => {
        _.extend(module, this.registerFunctions);
      });

      this.preBootModules = null;

      if (!checkBrowserCompatibility()) {
        setTimeout(() => {
          appEvents.emit(AppEvents.alertWarning, [
            'Your browser is not fully supported',
            'A newer browser version is recommended',
          ]);
        }, 1000);
      }
    });

    monkeyPatchInjectorWithPreAssignedBindings(injector);

    // Preload selected app plugins
    for (const modulePath of config.pluginsToPreload) {
      importPluginModule(modulePath);
    }
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
