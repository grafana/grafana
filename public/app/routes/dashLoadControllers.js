define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  'jquery',
],
function (angular, _, kbn, moment, $) {
  "use strict";

  var module = angular.module('grafana.routes');

  module.controller('LoadDashboardCtrl', function(
    $scope, $routeParams, backendSrv, dashboardSrv, datasourceSrv, $http, $q, $timeout, contextSrv) {

    function dashboardLoadFailed(title) {
      $scope.initDashboard({meta: {}, dashboard: {title: title}}, $scope);
    }

    // Home dashboard
    if (!$routeParams.slug) {
      backendSrv.get('/api/dashboards/home').then(function(result) {
        var meta = result.meta;
        meta.canSave = meta.canShare = meta.canEdit = meta.canStar = false;
        $scope.initDashboard(result, $scope);
      },function() {
        dashboardLoadFailed('Not found');
      });
      return;
    }

    // Scripted dashboards
    var execute_script = function(result) {
      var services = {
        dashboardSrv: dashboardSrv,
        datasourceSrv: datasourceSrv,
        $q: $q,
      };

      /*jshint -W054 */
      var script_func = new Function('ARGS','kbn','_','moment','window','document','$','jQuery', 'services', result.data);
      var script_result = script_func($routeParams, kbn, _ , moment, window, document, $, $, services);

      // Handle async dashboard scripts
      if (_.isFunction(script_result)) {
        var deferred = $q.defer();
        script_result(function(dashboard) {
          $timeout(function() {
            deferred.resolve({ data: dashboard });
          });
        });
        return deferred.promise;
      }

      return { data: script_result };
    };

    var script_load = function(file) {
      var url = 'public/dashboards/'+file.replace(/\.(?!js)/,"/") + '?' + new Date().getTime();

      return $http({ url: url, method: "GET" })
      .then(execute_script)
      .then(null,function(err) {
        console.log('Script dashboard error '+ err);
        $scope.appEvent('alert-error', ["Script Error", "Please make sure it exists and returns a valid dashboard"]);
        return false;
      });
    };

    function loadScriptedDashboard() {
      script_load($routeParams.slug).then(function(result) {
        $scope.initDashboard({
          meta: {fromScript: true, canDelete: false, canSave: false},
          dashboard: result.data
        }, $scope);
      });
    }

    if ($routeParams.type === 'script') {
      loadScriptedDashboard();
      return;
    }

    if ($routeParams.type === 'snapshot') {
      contextSrv.sidemenu = false;
      backendSrv.get('/api/snapshots/' + $routeParams.slug).then(function(result) {
        $scope.initDashboard(result, $scope);
      }, function() {
        $scope.initDashboard({meta:{isSnapshot: true, canSave: false, canEdit: false}, dashboard: {title: 'Snapshot not found'}}, $scope);
      });
      return;
    }

    return backendSrv.getDashboard($routeParams.type, $routeParams.slug).then(function(result) {
      $scope.initDashboard(result, $scope);
    }, function() {
      dashboardLoadFailed('Not found');
    });

  });

  module.controller('DashFromImportCtrl', function($scope, $location, alertSrv) {
    if (!window.grafanaImportDashboard) {
      alertSrv.set('Not found', 'Cannot reload page with unsaved imported dashboard', 'warning', 7000);
      $location.path('');
      return;
    }
    $scope.initDashboard({
      meta: { canShare: false, canStar: false },
      dashboard: window.grafanaImportDashboard
    }, $scope);
  });

  module.controller('NewDashboardCtrl', function($scope) {
    $scope.initDashboard({
      meta: { canStar: false, canShare: false },
      dashboard: {
        title: "New dashboard",
        rows: [{ height: '250px', panels:[] }]
      },
    }, $scope);
  });

});
