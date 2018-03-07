define([
  'angular',
  'jquery',
  'lodash',
  'require',
  'bootstrap',
  'angular-route',
  'angular-sanitize',
  'angular-strap',
  'angular-dragdrop',
  'angular-ui',
  'bindonce',
  'app/core/core',
],
function (angular, $, _, appLevelRequire) {
  "use strict";

  var app = angular.module('grafana', []);
  var register_fns = {};
  var preBootModules = [];

  // This stores the grafana version number
  app.constant('grafanaVersion',"@grafanaVersion@");

  /**
   * Tells the application to watch the module, once bootstraping has completed
   * the modules controller, service, etc. functions will be overwritten to register directly
   * with this application.
   * @param  {[type]} module [description]
   * @return {[type]}        [description]
   */
  app.useModule = function (module) {
    if (preBootModules) {
      preBootModules.push(module);
    } else {
      _.extend(module, register_fns);
    }
    return module;
  };

  app.config(function($locationProvider, $controllerProvider, $compileProvider, $filterProvider, $provide) {
    register_fns.controller = $controllerProvider.register;
    register_fns.directive  = $compileProvider.directive;
    register_fns.factory    = $provide.factory;
    register_fns.service    = $provide.service;
    register_fns.filter     = $filterProvider.register;
  });

  var apps_deps = [
    'grafana.core',
    'ngRoute',
    'ngSanitize',
    '$strap.directives',
    'ang-drag-drop',
    'grafana',
    'pasvaz.bindonce',
    'ui.bootstrap',
    'ui.bootstrap.tpls',
  ];

  var module_types = ['controllers', 'directives', 'factories', 'services', 'filters', 'routes'];

  _.each(module_types, function (type) {
    var module_name = 'grafana.'+type;
    // create the module
    app.useModule(angular.module(module_name, []));
    // push it into the apps dependencies
    apps_deps.push(module_name);
  });

  var preBootRequires = [
    'app/features/all',
  ];

  app.boot = function() {
    require(preBootRequires, function () {

      // disable tool tip animation
      $.fn.tooltip.defaults.animation = false;

      // bootstrap the app
      angular
        .element(document)
        .ready(function() {
          angular.bootstrap(document, apps_deps)
            .invoke(['$rootScope', function ($rootScope) {
              _.each(preBootModules, function (module) {
                _.extend(module, register_fns);
              });

              preBootModules = null;

              $rootScope.requireContext = appLevelRequire;
              $rootScope.require = function (deps, fn) {
                var $scope = this;
                $scope.requireContext(deps, function () {
                  var deps = _.toArray(arguments);
                  fn.apply($scope, deps);
                });
              };
            }]);
        });
    });
  };

  return app;
});
