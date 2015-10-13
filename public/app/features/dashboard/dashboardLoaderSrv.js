define([
  'angular',
  'moment',
  'lodash',
  'jquery',
  'kbn',
  'app/core/utils/datemath',
],
function (angular, moment, _, $, kbn, dateMath) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('dashboardLoaderSrv', function(backendSrv,
                                                   dashboardSrv,
                                                   datasourceSrv,
                                                   $http, $q, $timeout,
                                                   contextSrv, $routeParams,
                                                   $rootScope) {
    var self = this;

    this._dashboardLoadFailed = function(title) {
      return {meta: {canStar: false, canDelete: false, canSave: false}, dashboard: {title: title}};
    };

    this.loadDashboard = function(type, slug) {
      if (type === 'script') {
        return this._loadScriptedDashboard(slug);
      }

      if (type === 'snapshot') {
        return backendSrv.get('/api/snapshots/' + $routeParams.slug).catch(function() {
          return {meta:{isSnapshot: true, canSave: false, canEdit: false}, dashboard: {title: 'Snapshot not found'}};
        });
      }

      return backendSrv.getDashboard($routeParams.type, $routeParams.slug).catch(function() {
        return self._dashboardLoadFailed("Not found");
      });
    };

    this._loadScriptedDashboard = function(file) {
      var url = 'public/dashboards/'+file.replace(/\.(?!js)/,"/") + '?' + new Date().getTime();

      return $http({ url: url, method: "GET" })
      .then(this._executeScript).then(function(result) {
        return { meta: { fromScript: true, canDelete: false, canSave: false, canStar: false}, dashboard: result.data };
      }, function(err) {
        console.log('Script dashboard error '+ err);
        $rootScope.appEvent('alert-error', ["Script Error", "Please make sure it exists and returns a valid dashboard"]);
        return self._dashboardLoadFailed('Scripted dashboard');
      });
    };

    this._executeScript = function(result) {
      var services = {
        dashboardSrv: dashboardSrv,
        datasourceSrv: datasourceSrv,
        $q: $q,
      };

      /*jshint -W054 */
      var script_func = new Function('ARGS','kbn','dateMath','_','moment','window','document','$','jQuery', 'services', result.data);
      var script_result = script_func($routeParams, kbn, dateMath, _ , moment, window, document, $, $, services);

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

  });
});
