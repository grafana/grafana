define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SubmenuCtrl', function($scope, $q, $rootScope, templateValuesSrv, dynamicDashboardSrv) {
    var _d = {
      enable: true
    };

    _.defaults($scope.pulldown,_d);

    $scope.init = function() {
      $scope.panel = $scope.pulldown;
      $scope.row = $scope.pulldown;
      $scope.annotations = $scope.dashboard.templating.list;
      $scope.variables = $scope.dashboard.templating.list;
    };

    $scope.disableAnnotation = function (annotation) {
      annotation.enable = !annotation.enable;
      $rootScope.$broadcast('refresh');
    };

    $scope.getValuesForTag = function(variable, tagKey) {
      return templateValuesSrv.getValuesForTag(variable, tagKey);
    };

    $scope.variableUpdated = function(variable) {
      templateValuesSrv.variableUpdated(variable).then(function() {
        dynamicDashboardSrv.update($scope.dashboard);
        $rootScope.$broadcast('refresh');
      });
    };

    $scope.init();

  });

});
