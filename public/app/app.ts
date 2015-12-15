///<reference path="headers/common.d.ts" />

///<amd-dependency path="bootstrap" />
///<amd-dependency path="angular-strap" />
///<amd-dependency path="angular-route" />
///<amd-dependency path="angular-sanitize" />
///<amd-dependency path="angular-dragdrop" />
///<amd-dependency path="angular-bindonce" />
///<amd-dependency path="angular-ui" />
///<amd-dependency path="app/core/core" />

import 'es6-shim';
import 'es6-promise';

import _ = require('lodash');
import $ = require('jquery');
import bootstrap = require('bootstrap');
import kbn = require('app/core/utils/kbn');
import angular = require('angular');
import config = require('app/core/config');

class GrafanaApp {
  register_fns: any = {};

  useModule(module) {
    _.extend(module, this.register_fns);
    return module;
  }

  init() {
    var app = angular.module('grafana', []);
    app.constant('grafanaVersion', "@grafanaVersion@");

    app.config(($locationProvider, $controllerProvider, $compileProvider, $filterProvider, $provide) => {
      console.log('app config');
      this.register_fns.controller = $controllerProvider.register;
      this.register_fns.directive  = $compileProvider.directive;
      this.register_fns.factory    = $provide.factory;
      this.register_fns.service    = $provide.service;
      this.register_fns.filter     = $filterProvider.register;
    });

    var apps_deps = [
      'grafana.core',
      'ngRoute',
      'ngSanitize',
      '$strap.directives',
      'ang-drag-drop',
      'grafana',
      'pasvaz.bindonce',
      'ui.bootstrap.tabs',
    ];

    var module_types = ['controllers', 'directives', 'factories', 'services', 'filters', 'routes'];

    _.each(module_types, type => {
      var module_name = 'grafana.' + type;
      this.useModule(angular.module(module_name, []));
      apps_deps.push(module_name);
    });

    var preBootRequires = [System.import('app/features/all')];
    var pluginModules = config.bootData.pluginModules || [];

    // add plugin modules
    for (var i = 0; i < pluginModules.length; i++) {
      preBootRequires.push(System.import(pluginModules[i]));
    }

    Promise.all(preBootRequires).then(function() {
      // disable tool tip animation
      $.fn.tooltip.defaults.animation = false;
      // bootstrap the app
      var asd = angular.bootstrap(document, apps_deps).invoke(['$rootScope', function ($rootScope) {
        console.log('bootstrap');
      }]);
    }).catch(function(err) {
      console.log('Application boot failed: ' + err);
    });
  }
 }

 var grafanaApp = new GrafanaApp();

 export = {
   init: function() {
     grafanaApp.init();
   },
   useModule: function(m) {
     grafanaApp.useModule(m);
   }
 };
