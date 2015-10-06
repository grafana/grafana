define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SubmenuCtrl', function($scope, $q, $rootScope, templateValuesSrv, dynamicDashboardSrv) {

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
        $rootScope.$emit('template-variable-value-updated');
        $rootScope.$broadcast('refresh');
      });
    };

    $scope.init();

  });

});
