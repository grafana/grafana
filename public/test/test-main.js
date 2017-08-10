(function() {
  "use strict";

  // Tun on full stack traces in errors to help debugging
  Error.stackTraceLimit=Infinity;

  window.__karma__.loaded = function() {};

  System.config({
    baseURL: '/base/',
    defaultJSExtensions: true,
    paths: {
      'mousetrap': 'vendor/npm/mousetrap/mousetrap.js',
      'eventemitter3': 'vendor/npm/eventemitter3/index.js',
      'remarkable': 'vendor/npm/remarkable/dist/remarkable.js',
      'tether': 'vendor/npm/tether/dist/js/tether.js',
      'tether-drop': 'vendor/npm/tether-drop/dist/js/drop.js',
      'moment': 'vendor/moment.js',
      "jquery": "vendor/jquery/dist/jquery.js",
      'lodash-src': 'vendor/lodash/dist/lodash.js',
      "lodash": 'app/core/lodash_extended.js',
      "angular": 'vendor/angular/angular.js',
      'angular-mocks': 'vendor/angular-mocks/angular-mocks.js',
      "bootstrap":  "vendor/bootstrap/bootstrap.js",
      'angular-route':          'vendor/angular-route/angular-route.js',
      'angular-sanitize':       'vendor/angular-sanitize/angular-sanitize.js',
      "angular-ui":             "vendor/angular-ui/ui-bootstrap-tpls.js",
      "angular-strap":          "vendor/angular-other/angular-strap.js",
      "angular-dragdrop":       "vendor/angular-native-dragdrop/draganddrop.js",
      "angular-bindonce":       "vendor/angular-bindonce/bindonce.js",
      "spectrum": "vendor/spectrum.js",
      "bootstrap-tagsinput": "vendor/tagsinput/bootstrap-tagsinput.js",
      "jquery.flot": "vendor/flot/jquery.flot",
      "jquery.flot.pie": "vendor/flot/jquery.flot.pie",
      "jquery.flot.selection": "vendor/flot/jquery.flot.selection",
      "jquery.flot.stack": "vendor/flot/jquery.flot.stack",
      "jquery.flot.stackpercent": "vendor/flot/jquery.flot.stackpercent",
      "jquery.flot.time": "vendor/flot/jquery.flot.time",
      "jquery.flot.crosshair": "vendor/flot/jquery.flot.crosshair",
      "jquery.flot.fillbelow": "vendor/flot/jquery.flot.fillbelow",
      "jquery.flot.gauge": "vendor/flot/jquery.flot.gauge",
      "d3": "vendor/d3/d3.js",
      "jquery.flot.dashes": "vendor/flot/jquery.flot.dashes",
      "ace": "vendor/npm/ace-builds/src-noconflict/ace",
    },

    packages: {
      app: {
        defaultExtension: 'js',
      },
      vendor: {
        defaultExtension: 'js',
      },
    },

    map: {
    },

    meta: {
      'vendor/angular/angular.js': {
        format: 'global',
        deps: ['jquery'],
        exports: 'angular',
      },
      'vendor/angular-mocks/angular-mocks.js': {
        format: 'global',
        deps: ['angular'],
      },
      'vendor/npm/eventemitter3/index.js': {
        format: 'cjs',
        exports: 'EventEmitter'
      },
      'vendor/npm/mousetrap/mousetrap.js': {
        format: 'global',
        exports: 'Mousetrap'
      },
      'vendor/npm/ace-builds/src-noconflict/ace.js': {
        format: 'global',
        exports: 'ace'
      },
    }
  });

  function file2moduleName(filePath) {
    return filePath.replace(/\\/g, '/')
    .replace(/^\/base\//, '')
      .replace(/\.\w*$/, '');
  }

  function onlySpecFiles(path) {
    return /specs.*/.test(path);
  }

  window.grafanaBootData = {settings: {}};

  var modules = ['angular', 'angular-mocks', 'app/app'];
  var promises = modules.map(function(name) {
    return System.import(name);
  });

  Promise.all(promises).then(function(deps) {
    var angular = deps[0];

    angular.module('grafana', ['ngRoute']);
    angular.module('grafana.services', ['ngRoute', '$strap.directives']);
    angular.module('grafana.panels', []);
    angular.module('grafana.controllers', []);
    angular.module('grafana.directives', []);
    angular.module('grafana.filters', []);
    angular.module('grafana.routes', ['ngRoute']);

    // load specs
    return Promise.all(
      Object.keys(window.__karma__.files) // All files served by Karma.
      .filter(onlySpecFiles)
      .map(file2moduleName)
      .map(function(path) {
        // console.log(path);
        return System.import(path);
      }));
  }).then(function()  {
    window.__karma__.start();
  }, function(error) {
    window.__karma__.error(error.stack || error);
  }).catch(function(error) {
    window.__karma__.error(error.stack || error);
  });

})();
