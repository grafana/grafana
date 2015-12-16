///<reference path="headers/common.d.ts" />

import 'bootstrap';
import 'lodash-src';
import 'angular-strap';
import 'angular-route';
import 'angular-sanitize';
import 'angular-dragdrop';
import 'angular-bindonce';
import 'angular-ui';
import 'app/core/core';

import _ = require('lodash');
import $ = require('jquery');
import bootstrap = require('bootstrap');
import kbn = require('app/core/utils/kbn');
import angular = require('angular');
import config = require('app/core/config');

class GrafanaApp {
  registerFunctions: any;
  ngModuleDependencies: any[];
  preBootModules: any[];

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
    this.registerFunctions = {};
    this.preBootModules = [];

    var app = angular.module('grafana', []);
    app.constant('grafanaVersion', "@grafanaVersion@");

    app.config(($locationProvider, $controllerProvider, $compileProvider, $filterProvider, $provide) => {
      console.log('app config');
      this.registerFunctions.controller = $controllerProvider.register;
      this.registerFunctions.directive  = $compileProvider.directive;
      this.registerFunctions.factory    = $provide.factory;
      this.registerFunctions.service    = $provide.service;
      this.registerFunctions.filter     = $filterProvider.register;
    });

    this.ngModuleDependencies = [
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
      var moduleName = 'grafana.' + type;
      this.useModule(angular.module(moduleName, []));
    });

    var preBootRequires = [System.import('app/features/all')];
    var pluginModules = config.bootData.pluginModules || [];

    // add plugin modules
    for (var i = 0; i < pluginModules.length; i++) {
      preBootRequires.push(System.import(pluginModules[i]));
    }

    Promise.all(preBootRequires).then(() => {
      // disable tool tip animation
      $.fn.tooltip.defaults.animation = false;
      // bootstrap the app
      angular.bootstrap(document, this.ngModuleDependencies).invoke(() => {
        _.each(this.preBootModules, module => {
          _.extend(module, this.registerFunctions);
        });

        this.preBootModules = null;
      });
    }).catch(function(err) {
      console.log('Application boot failed:', err);
    });
  }
 }

 var grafanaApp = new GrafanaApp();

 export default {
   init: function() {
     grafanaApp.init();
   },
   useModule: function(m) {
     grafanaApp.useModule(m);
   }
 };
