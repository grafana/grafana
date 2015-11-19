require.config({
  baseUrl: 'http://localhost:9876/base/',

  paths: {
    lodash:                'app/core/lodash_extended',
    'lodash-src':          'vendor/lodash',

    moment:                'vendor/moment',
    chromath:              'vendor/chromath',
    filesaver:             'vendor/filesaver',

    angular:                  'vendor/angular/angular',
    'angular-route':          'vendor/angular-route/angular-route',
    'angular-sanitize':       'vendor/angular-sanitize/angular-sanitize',
    angularMocks:             'vendor/angular-mocks/angular-mocks',
    'angular-dragdrop':       'vendor/angular-native-dragdrop/draganddrop',
    'angular-ui':             'vendor/angular-ui/ui-bootstrap-tpls',
    'angular-strap':          'vendor/angular-other/angular-strap',
    timepicker:               'vendor/angular-other/timepicker',
    datepicker:               'vendor/angular-other/datepicker',
    bindonce:                 'vendor/angular-bindonce/bindonce',
    crypto:                   'vendor/crypto.min',
    spectrum:                 'vendor/spectrum',
    jquery:                   'vendor/jquery/dist/jquery',

    bootstrap:                'vendor/bootstrap/bootstrap',
    'bootstrap-tagsinput':    'vendor/tagsinput/bootstrap-tagsinput',

    'extend-jquery':          'app/components/extend-jquery',

    'jquery.flot':             'vendor/flot/jquery.flot',
    'jquery.flot.pie':         'vendor/flot/jquery.flot.pie',
    'jquery.flot.events':      'vendor/flot/jquery.flot.events',
    'jquery.flot.selection':   'vendor/flot/jquery.flot.selection',
    'jquery.flot.stack':       'vendor/flot/jquery.flot.stack',
    'jquery.flot.stackpercent':'vendor/flot/jquery.flot.stackpercent',
    'jquery.flot.time':        'vendor/flot/jquery.flot.time',
    'jquery.flot.crosshair':   'vendor/flot/jquery.flot.crosshair',
    'jquery.flot.fillbelow':   'vendor/flot/jquery.flot.fillbelow',

    modernizr:                'vendor/modernizr-2.6.1',
  },

  shim: {
    bootstrap: {
      deps: ['jquery']
    },

    modernizr: {
      exports: 'Modernizr'
    },

    angular: {
      deps: ['jquery'],
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
    'angular-ui':           ['angular'],
    'angular-dragdrop':     ['jquery', 'angular'],
    'angular-mocks':        ['angular'],
    'angular-strap':        ['angular', 'bootstrap','timepicker', 'datepicker'],
    'bindonce':             ['angular'],

    'bootstrap-tagsinput':          ['jquery'],

    timepicker:             ['jquery', 'bootstrap'],
    datepicker:             ['jquery', 'bootstrap'],
  }
});

function file2moduleName(filePath) {
  'use strict';
  return filePath.replace(/\\/g, '/')
    .replace(/^\/base\//, '')
    .replace(/\.\w*$/, '');
}

window.grafanaBootData = {};

require([
  'lodash',
  'angular',
  'angularMocks',
  'app/app',
], function(_, angular) {
  'use strict';

  var specs = [];

  for (var file in window.__karma__.files) {
    if (/specs.*/.test(file)) {
      file = file2moduleName(file);
      specs.push(file);
    }
  }

  angular.module('grafana', ['ngRoute']);
  angular.module('grafana.services', ['ngRoute', '$strap.directives']);
  angular.module('grafana.panels', []);
  angular.module('grafana.filters', []);
  angular.module('grafana.routes', ['ngRoute']);

  require(specs, function() {
    window.__karma__.start();
  });

});
