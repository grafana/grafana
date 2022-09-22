import 'angular';
import 'angular-route';
import 'angular-sanitize';
import 'angular-bindonce';
import 'vendor/bootstrap/bootstrap';

import angular from 'angular'; // eslint-disable-line no-duplicate-imports
import { extend } from 'lodash';

import { getTemplateSrv } from '@grafana/runtime';
import coreModule, { angularModules } from 'app/angular/core_module';
import appEvents from 'app/core/app_events';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { exposeToPlugin } from 'app/features/plugins/plugin_loader';
import * as sdk from 'app/plugins/sdk';

import { registerAngularDirectives } from './angular_wrappers';
import { initAngularRoutingBridge } from './bridgeReactAngularRouting';
import { monkeyPatchInjectorWithPreAssignedBindings } from './injectorMonkeyPatch';
import { promiseToDigest } from './promiseToDigest';
import { registerComponents } from './registerComponents';

export class AngularApp {
  ngModuleDependencies: any[];
  preBootModules: any[];
  registerFunctions: any;

  constructor() {
    this.preBootModules = [];
    this.ngModuleDependencies = [];
    this.registerFunctions = {};
  }

  init() {
    const app = angular.module('grafana', []);

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

    this.ngModuleDependencies = ['grafana.core', 'ngSanitize', 'grafana', 'pasvaz.bindonce', 'react'];

    // makes it possible to add dynamic stuff
    angularModules.forEach((m: angular.IModule) => {
      this.useModule(m);
    });

    // register react angular wrappers
    angular.module('grafana.services').service('dashboardLoaderSrv', DashboardLoaderSrv);

    coreModule.factory('timeSrv', () => getTimeSrv());
    coreModule.factory('templateSrv', () => getTemplateSrv());

    registerAngularDirectives();
    registerComponents();
    initAngularRoutingBridge();

    // Angular plugins import this
    exposeToPlugin('angular', angular);
    exposeToPlugin('app/core/utils/promiseToDigest', { promiseToDigest, __esModule: true });
    exposeToPlugin('app/plugins/sdk', sdk);
    exposeToPlugin('app/core/core_module', coreModule);
    exposeToPlugin('app/core/core', {
      coreModule: coreModule,
      appEvents: appEvents,
      contextSrv: contextSrv,
      __esModule: true,
    });

    // disable tool tip animation
    $.fn.tooltip.defaults.animation = false;
  }

  useModule(module: angular.IModule) {
    if (this.preBootModules) {
      this.preBootModules.push(module);
    } else {
      extend(module, this.registerFunctions);
    }
    this.ngModuleDependencies.push(module.name);
    return module;
  }

  bootstrap() {
    const injector = angular.bootstrap(document.getElementById('ngRoot')!, this.ngModuleDependencies);

    monkeyPatchInjectorWithPreAssignedBindings(injector);

    injector.invoke(() => {
      this.preBootModules.forEach((module) => {
        extend(module, this.registerFunctions);
      });

      // I don't know
      return () => {};
    });

    return injector;
  }
}
