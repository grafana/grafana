require.config({
  baseUrl: 'http://localhost:9876/base/public/app',

  paths: {
    text:                  '../vendor/require/text',
    specs:                 '../test/specs',
    mocks:                 '../test/mocks',
    helpers:               '../test/specs/helpers',
    config:                'components/config',
    kbn:                   'components/kbn',
    store:                 'components/store',

    settings:              'components/settings',
    lodash:                'components/lodash.extended',
    'lodash-src':          '../vendor/lodash',

    moment:                '../vendor/moment',
    chromath:              '../vendor/chromath',
    filesaver:             '../vendor/filesaver',

    angular:               '../vendor/angular/angular',
    'angular-route':       '../vendor/angular/angular-route',
    'angular-sanitize':    '../vendor/angular/angular-sanitize',
    angularMocks:          '../vendor/angular/angular-mocks',
    'angular-dragdrop':       '../vendor/angular/angular-dragdrop',
    'angular-strap':          '../vendor/angular/angular-strap',
    timepicker:               '../vendor/angular/timepicker',
    datepicker:               '../vendor/angular/datepicker',
    bindonce:                 '../vendor/angular/bindonce',
    crypto:                   '../vendor/crypto.min',
    spectrum:                 '../vendor/spectrum',

    jquery:                   '../vendor/jquery/jquery-2.1.3',

    bootstrap:                '../vendor/bootstrap/bootstrap',
    'bootstrap-tagsinput':    '../vendor/tagsinput/bootstrap-tagsinput',

    'extend-jquery':          'components/extend-jquery',

    'jquery.flot':            '../vendor/jquery/jquery.flot',
    'jquery.flot.pie':        '../vendor/jquery/jquery.flot.pie',
    'jquery.flot.events':     '../vendor/jquery/jquery.flot.events',
    'jquery.flot.selection':  '../vendor/jquery/jquery.flot.selection',
    'jquery.flot.stack':      '../vendor/jquery/jquery.flot.stack',
    'jquery.flot.stackpercent':'../vendor/jquery/jquery.flot.stackpercent',
    'jquery.flot.time':       '../vendor/jquery/jquery.flot.time',
    'jquery.flot.crosshair':  '../vendor/jquery/jquery.flot.crosshair',
    'jquery.flot.fillbelow':  '../vendor/jquery/jquery.flot.fillbelow',

    modernizr:                '../vendor/modernizr-2.6.1',
  },

  shim: {
    bootstrap: {
      deps: ['jquery']
    },

    modernizr: {
      exports: 'Modernizr'
    },

    angular: {
      deps: ['jquery', 'config'],
      exports: 'angular'
    },

    angularMocks: {
      deps: ['angular'],
    },

    crypto: {
      exports: 'Crypto'
    },

    'jquery.flot':          ['jquery'],
    'jquery.flot.pie':      ['jquery', 'jquery.flot'],
    'jquery.flot.events':   ['jquery', 'jquery.flot'],
    'jquery.flot.selection':['jquery', 'jquery.flot'],
    'jquery.flot.stack':    ['jquery', 'jquery.flot'],
    'jquery.flot.stackpercent':['jquery', 'jquery.flot'],
    'jquery.flot.time':     ['jquery', 'jquery.flot'],
    'jquery.flot.crosshair':['jquery', 'jquery.flot'],
    'jquery.flot.fillbelow':['jquery', 'jquery.flot'],

    'angular-route':        ['angular'],
    'angular-sanitize':     ['angular'],
    'angular-dragdrop':     ['jquery', 'angular'],
    'angular-mocks':        ['angular'],
    'angular-strap':        ['angular', 'bootstrap','timepicker', 'datepicker'],
    'bindonce':             ['angular'],

    'bootstrap-tagsinput':          ['jquery'],

    timepicker:             ['jquery', 'bootstrap'],
    datepicker:             ['jquery', 'bootstrap'],
  }
});

require([
  'angular',
  'config',
  'angularMocks',
  'app',
], function(angular, config) {
  'use strict';

  for (var file in window.__karma__.files) {
    if (/spec\.js$/.test(file)) {
      window.tests.push(file.replace(/^\/base\//, 'http://localhost:9876/base/'));
    }
  }


  angular.module('grafana', ['ngRoute']);
  angular.module('grafana.services', ['ngRoute', '$strap.directives']);
  angular.module('grafana.panels', []);
  angular.module('grafana.filters', []);
  angular.module('grafana.routes', ['ngRoute']);

  var specs = [
    'specs/lexer-specs',
    'specs/parser-specs',
    'specs/gfunc-specs',
    'specs/timeSeries-specs',
    'specs/row-ctrl-specs',
    'specs/graphiteTargetCtrl-specs',
    'specs/graphiteDatasource-specs',
    'specs/influxSeries-specs',
    'specs/influxQueryBuilder-specs',
    'specs/influx09-querybuilder-specs',
    'specs/influxdb-datasource-specs',
    'specs/graph-ctrl-specs',
    'specs/graph-specs',
    'specs/graph-tooltip-specs',
    'specs/seriesOverridesCtrl-specs',
    'specs/shareModalCtrl-specs',
    'specs/timeSrv-specs',
    'specs/templateSrv-specs',
    'specs/templateValuesSrv-specs',
    'specs/kbn-format-specs',
    'specs/dashboardSrv-specs',
    'specs/dashboardViewStateSrv-specs',
    'specs/table-specs',
    'specs/table-ctrl-specs',
    'specs/singlestat-specs',
    'specs/dynamicDashboardSrv-specs',
    'specs/unsavedChangesSrv-specs',
    'specs/valueSelectDropdown-specs',
  ];

  var pluginSpecs = (config.plugins.specs || []).map(function (spec) {
    return '../plugins/' + spec;
  });

  require(specs.concat(pluginSpecs), function () {
    window.__karma__.start();
  });
});

