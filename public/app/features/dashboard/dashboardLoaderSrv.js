define([
  'angular',
  'moment',
  'lodash',
  'jquery',
  'app/core/utils/kbn',
  'app/core/utils/datemath',
  'app/core/services/impression_srv'
],
function (angular, moment, _, $, kbn, dateMath, impressionSrv) {
  'use strict';

  kbn = kbn.default;
  impressionSrv = impressionSrv.default;

  var module = angular.module('grafana.services');

  module.service('dashboardLoaderSrv', function(backendSrv,
                                                   dashboardSrv,
                                                   datasourceSrv,
                                                   $http, $q, $timeout,
                                                   contextSrv, $routeParams,
                                                   $rootScope) {
    var self = this;

    this._dashboardLoadFailed = function(title, snapshot) {
      snapshot = snapshot || false;
      return {
        meta: { canStar: false, isSnapshot: snapshot, canDelete: false, canSave: false, canEdit: false, dashboardNotFound: true },
        dashboard: {title: title }
      };
    };

    this.loadDashboard = function(type, slug) {
      var promise;

      if (type === 'script') {
        promise = this._loadScriptedDashboard(slug);
      } else if (type === 'snapshot') {
        promise = backendSrv.get('/api/snapshots/' + $routeParams.slug)
          .catch(function() {
            return self._dashboardLoadFailed("Snapshot not found", true);
          });
      } else {
        promise = backendSrv.getDashboard($routeParams.type, $routeParams.slug)
          .then(function(result) {
            if (result.meta.isFolder) {
              $rootScope.appEvent("alert-error", ['Dashboard not found']);
              throw new Error("Dashboard not found");
            }
            return result;
          })
          .catch(function() {
            return self._dashboardLoadFailed("Not found");
          });
      }

      promise.then(function(result) {

        if (result.meta.dashboardNotFound !== true) {
          impressionSrv.addDashboardImpression(result.dashboard.id);
        }

        return result;
      });

      return promise;
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
