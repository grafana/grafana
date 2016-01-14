define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SubmenuCtrl', function($scope, $q, $rootScope, templateValuesSrv, templateSrv, dynamicDashboardSrv) {

    $scope.init = function() {
      $scope.panel = $scope.pulldown;
      $scope.row = $scope.pulldown;
      $scope.annotations = $scope.dashboard.templating.list;
      $scope.variables = $scope.dashboard.templating.list;
      $scope.dashboard_autoupdate = templateSrv.dashboard_autoupdate;
      $scope.must_reload = !templateSrv.dashboard_autoupdate;
    };

    $scope.disableAnnotation = function (annotation) {
      annotation.enable = !annotation.enable;
      $rootScope.$broadcast('refresh');
    };

    $scope.getValuesForTag = function(variable, tagKey) {
      return templateValuesSrv.getValuesForTag(variable, tagKey);
    };

    $scope.variableUpdated = function(variable) {
      $scope.dashboard_autoupdate=templateSrv.dashboard_autoupdate;
      if(!$scope.dashboard_autoupdate){
        $scope.must_reload=true;
      }
      templateValuesSrv.variableUpdated(variable).then(function() {
        if(templateSrv.dashboard_autoupdate) {
          dynamicDashboardSrv.update($scope.dashboard);
          $rootScope.$emit('template-variable-value-updated');
          $rootScope.$broadcast('refresh');
        }
        else {
          $rootScope.$emit('template-variable-value-updated');
        }
      });
    };
    $scope.refreshDashboard = function () {
      $rootScope.$broadcast('refresh');
      $scope.must_reload=false;
    };
    $scope.init();

  });

});
