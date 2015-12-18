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

import $ from 'jquery';
import angular from 'angular';
import _ = require('lodash');
import bootstrap = require('bootstrap');
import kbn = require('app/core/utils/kbn');
import config = require('app/core/config');

// import {Component} from 'vendor/npm/angular2/core';
// console.log(Component);

export class GrafanaApp {
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
      'ui.bootstrap.tpls',
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

