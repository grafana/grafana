define([
  'angular',
],
function (angular) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('panelInfoEditor', function() {
      return {
        scope: {
          panel: "="
        },
        restrict: 'E',
        controller: 'PanelInfoEditorCtrl',
        templateUrl: 'app/features/panelinfo/partials/panelInfoEdit.html',
        link: function() {
        }
      };
    }).controller('PanelInfoEditorCtrl', function($scope,timeSrv) {
      $scope.init = function () {
        $scope.panel.helpInfo = $scope.panel.helpInfo || {info: false, title:'',context:''};
      };
      $scope.editInfo = function () {
        $scope.init();
        $scope.panel.helpInfo.info = !$scope.panel.helpInfo.info;
        timeSrv.refreshDashboard();
      };
      $scope.removeInfo = function () {
        $scope.panel.helpInfo = null;
        timeSrv.refreshDashboard();
      };
      $scope.init();
    });
});
