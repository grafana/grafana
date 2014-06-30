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
      })
      .when('/dashboard/temp/:id', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromElasticProvider',
      });
  });

  module.controller('DashFromElasticProvider', function($scope, $rootScope, elastic, $routeParams, alertSrv) {

    var elasticsearch_load = function(id) {
      var url = '/dashboard/' + id;

      // hack to check if it is a temp dashboard
      if (window.location.href.indexOf('dashboard/temp') > 0) {
        url = '/temp/' + id;
      }

      return elastic.get(url)
        .then(function(result) {
          if (result._source && result._source.dashboard) {
            return angular.fromJson(result._source.dashboard);
          } else {
            return false;
          }
        }, function(data, status) {
          if(status === 0) {
            alertSrv.set('Error',"Could not contact Elasticsearch at " +
              config.elasticsearch + ". Please ensure that Elasticsearch is reachable from your browser.",'error');
          } else {
            alertSrv.set('Error',"Could not find dashboard " + id, 'error');
          }
          return false;
        });
    };

    elasticsearch_load($routeParams.id).then(function(dashboard) {
      $scope.emitAppEvent('setup-dashboard', dashboard);
    });

  });

});
