define([
  'angular',
  'jquery',
  'config',
  'underscore'
],
function (angular, $, config, _) {
  "use strict";

  var module = angular.module('kibana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/dashboard/:title', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromFileProvider',
      });
  });

  module.controller('DashFromFileProvider', function($scope, $rootScope, $http, $routeParams, alertSrv) {

    var load_dashboard = function(title) {
      return $http({
        url: "api/dashboards/" + title +'?' + new Date().getTime(),
        method: "GET",
      }).then(function(result) {
        if(!result) {
          return false;
        }

        console.log(result);

        return result.data;
      },function() {
        alertSrv.set('Error',"Could not load <i>dashboards/" + title + "</i>. Please make sure it exists" ,'error');
        return false;
      });
    };

    load_dashboard($routeParams.title).then(function(result) {
      $scope.emitAppEvent('setup-dashboard', result);
    });

  });

});
