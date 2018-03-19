import 'babel-polyfill';
import 'file-saver';
import 'lodash';
import 'jquery';
import 'angular';
import 'angular-route';
import 'angular-sanitize';
import 'angular-native-dragdrop';
import 'angular-bindonce';
import 'react';
import 'react-dom';

import 'vendor/bootstrap/bootstrap';
import 'vendor/angular-ui/ui-bootstrap-tpls';
import 'vendor/angular-other/angular-strap';

import $ from 'jquery';
import angular from 'angular';
import config from 'app/core/config';
import _ from 'lodash';
import moment from 'moment';

// add move to lodash for backward compatabiltiy
_.move = function(array, fromIndex, toIndex) {
  array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
  return array;
};

import { coreModule, registerAngularDirectives } from './core/core';
import { setupAngularRoutes } from './routes/routes';

declare var System: any;

export class GrafanaApp {
  registerFunctions: any;
  ngModuleDependencies: any[];
  preBootModules: any[];

  constructor() {
    this.preBootModules = [];
    this.registerFunctions = {};
    this.ngModuleDependencies = [];
  }

  useModule(module) {
    if (this.preBootModules) {
      this.preBootModules.push(module);
    } else {
      _.extend(module, this.registerFunctions);
    }
    this.ngModuleDependencies.push(module.name);
    return module;
  }

  init() {
    var app = angular.module('grafana', []);

    moment.locale(config.bootData.user.locale);

    app.config(($locationProvider, $controllerProvider, $compileProvider, $filterProvider, $httpProvider, $provide) => {
      // pre assing bindings before constructor calls
      $compileProvider.preAssignBindingsEnabled(true);

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
        function($delegate, $templateCache) {
          var get = $delegate.get;
          $delegate.get = function(url, config) {
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
    });

    this.ngModuleDependencies = [
      'grafana.core',
      'ngRoute',
      'ngSanitize',
      '$strap.directives',
      'ang-drag-drop',
      'grafana',
      'pasvaz.bindonce',
      'ui.bootstrap',
      'ui.bootstrap.tpls',
      'react',
    ];

    var module_types = ['controllers', 'directives', 'factories', 'services', 'filters', 'routes'];

    _.each(module_types, type => {
      var moduleName = 'grafana.' + type;
      this.useModule(angular.module(moduleName, []));
    });

    // makes it possible to add dynamic stuff
    this.useModule(coreModule);

    // register react angular wrappers
    coreModule.config(setupAngularRoutes);
    registerAngularDirectives();

    var preBootRequires = [System.import('app/features/all')];

    Promise.all(preBootRequires)
      .then(() => {
        // disable tool tip animation
        $.fn.tooltip.defaults.animation = false;

        // bootstrap the app
        angular.bootstrap(document, this.ngModuleDependencies).invoke(() => {
          _.each(this.preBootModules, module => {
            _.extend(module, this.registerFunctions);
          });

          this.preBootModules = null;
        });
      })
      .catch(function(err) {
        console.log('Application boot failed:', err);
      });
  }
}

export default new GrafanaApp();
