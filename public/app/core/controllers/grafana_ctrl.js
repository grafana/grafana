define([
  'angular',
  'lodash',
  'jquery',
  '../core_module',
  'app/core/config',
  'app/core/store',
],
function (angular, _, $, coreModule, config, store) {
  "use strict";

  coreModule.controller('GrafanaCtrl', function($scope, alertSrv, utilSrv, $rootScope, $controller, contextSrv) {

    $scope.init = function() {
      $scope.contextSrv = contextSrv;

      $scope._ = _;

      $rootScope.profilingEnabled = store.getBool('profilingEnabled');
      $rootScope.performance = { loadStart: new Date().getTime() };
      $rootScope.appSubUrl = config.appSubUrl;

      if ($rootScope.profilingEnabled) { $scope.initProfiling(); }

      alertSrv.init();
      utilSrv.init();

      $scope.dashAlerts = alertSrv;
    };

    $scope.initDashboard = function(dashboardData, viewScope) {
      $controller('DashboardCtrl', { $scope: viewScope }).init(dashboardData);
    };

    $rootScope.onAppEvent = function(name, callback, localScope) {
      var unbind = $rootScope.$on(name, callback);
      var callerScope = this;
      if (callerScope.$id === 1 && !localScope) {
        console.log('warning rootScope onAppEvent called without localscope');
      }
      if (localScope) {
        callerScope = localScope;
      }
      callerScope.$on('$destroy', unbind);
    };

    $rootScope.appEvent = function(name, payload) {
      $rootScope.$emit(name, payload);
    };

    $rootScope.colors = [
      "#7EB26D","#EAB839","#6ED0E0","#EF843C","#E24D42","#1F78C1","#BA43A9","#705DA0", //1
      "#508642","#CCA300","#447EBC","#C15C17","#890F02","#0A437C","#6D1F62","#584477", //2
      "#B7DBAB","#F4D598","#70DBED","#F9BA8F","#F29191","#82B5D8","#E5A8E2","#AEA2E0", //3
      "#629E51","#E5AC0E","#64B0C8","#E0752D","#BF1B00","#0A50A1","#962D82","#614D93", //4
      "#9AC48A","#F2C96D","#65C5DB","#F9934E","#EA6460","#5195CE","#D683CE","#806EB7", //5
      "#3F6833","#967302","#2F575E","#99440A","#58140C","#052B51","#511749","#3F2B5B", //6
      "#E0F9D7","#FCEACA","#CFFAFF","#F9E2D2","#FCE2DE","#BADFF4","#F9D9F9","#DEDAF7"  //7
    ];

    $scope.getTotalWatcherCount = function() {
      var count = 0;
      var scopes = 0;
      var root = $(document.getElementsByTagName('body'));

      var f = function (element) {
        if (element.data().hasOwnProperty('$scope')) {
          scopes++;
          angular.forEach(element.data().$scope.$$watchers, function () {
            count++;
          });
        }

        angular.forEach(element.children(), function (childElement) {
          f($(childElement));
        });
      };

      f(root);
      $rootScope.performance.scopeCount = scopes;
      return count;
    };

    $scope.initProfiling = function() {
      var count = 0;

      $scope.$watch(function digestCounter() {
        count++;
      }, function() {
      });

      $rootScope.performance.panels = [];

      $scope.$on('refresh', function() {
        if ($rootScope.performance.panels.length > 0) {
          var totalRender = 0;
          var totalQuery = 0;

          _.each($rootScope.performance.panels, function(panelTiming) {
            totalRender += panelTiming.render;
            totalQuery += panelTiming.query;
          });

          console.log('total query: ' + totalQuery);
          console.log('total render: ' + totalRender);
          console.log('avg render: ' + totalRender / $rootScope.performance.panels.length);
        }

        $rootScope.performance.panels = [];
      });

      $scope.onAppEvent('dashboard-loaded', function() {
        count = 0;

        setTimeout(function() {
          console.log("Dashboard::Performance Total Digests: " + count);
          console.log("Dashboard::Performance Total Watchers: " + $scope.getTotalWatcherCount());
          console.log("Dashboard::Performance Total ScopeCount: " + $rootScope.performance.scopeCount);

          var timeTaken = $rootScope.performance.allPanelsInitialized - $rootScope.performance.dashboardLoadStart;
          console.log("Dashboard::Performance - All panels initialized in " + timeTaken + " ms");

          // measure digest performance
          var rootDigestStart = window.performance.now();
          for (var i = 0; i < 30; i++) {
            $rootScope.$apply();
          }
          console.log("Dashboard::Performance Root Digest " + ((window.performance.now() - rootDigestStart) / 30));

        }, 3000);

      });

    };

    $scope.init();

  });
});
