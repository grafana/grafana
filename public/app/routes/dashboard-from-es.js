define([
  'angular',
  'jquery',
  'config'
],
function (angular, $, config) {
  "use strict";

  var module = angular.module('kibana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/elasticsearch/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromElasticProvider',
      });
  });

  module.controller('DashFromElasticProvider', function($scope, $rootScope, $http, $routeParams, alertSrv) {

    var elasticsearch_load = function(id) {
      var url = config.elasticsearch + "/" + config.grafana_index + "/dashboard/" + id;

      var options = {
        url: url +'?' + new Date().getTime(),
        method: "GET",
        transformResponse: function(response) {
          var esResponse = angular.fromJson(response);
          if (esResponse._source && esResponse._source.dashboard) {
            return angular.fromJson(esResponse._source.dashboard);
          } else {
            return false;
          }
        }
      };

      if (config.elasticsearchBasicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": "Basic " + config.elasticsearchBasicAuth
        };
      }

      return $http(options)
        .error(function(data, status) {
          if(status === 0) {
            alertSrv.set('Error',"Could not contact Elasticsearch at " +
              config.elasticsearch + ". Please ensure that Elasticsearch is reachable from your browser.",'error');
          } else {
            alertSrv.set('Error',"Could not find dashboard " + id, 'error');
          }
          return false;
        });
    };

    elasticsearch_load($routeParams.id).then(function(result) {
      $scope.emitAppEvent('setup-dashboard', result.data);
    });

  });

});
