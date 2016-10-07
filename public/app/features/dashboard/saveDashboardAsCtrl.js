define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SaveDashboardAsCtrl', function($scope, backendSrv, $location) {

    $scope.init = function() {
      $scope.clone.id = null;
      $scope.clone.editable = true;
      $scope.clone.title = $scope.clone.title + " Copy";
    };

    function saveDashboard(options) {
      return backendSrv.saveDashboard($scope.clone, options).then(function(result) {
        $scope.appEvent('alert-success', ['仪表盘已经保存', '保存为 ' + $scope.clone.title]);

        $location.url('/dashboard/db/' + result.slug);

        $scope.appEvent('dashboard-saved', $scope.clone);
        backendSrv.post("/api/dashboards/system", {DashId: result.id.toString(), SystemId: clone.system});
        $scope.dismiss();
      });
    }

    $scope.keyDown = function (evt) {
      if (evt.keyCode === 13) {
        $scope.saveClone();
      }
    };

    $scope.saveClone = function() {
      saveDashboard({overwrite: false}).then(null, function(err) {
        if (err.data && err.data.status === "name-exists") {
          err.isHandled = true;

          $scope.appEvent('confirm-modal', {
            title: '已经有相同名字的仪表盘存在',
            text: "您是否需要覆盖?",
            yesText: "保存 & 覆盖",
            icon: "fa-warning",
            onConfirm: function() {
              saveDashboard({overwrite: true});
            }
          });
        }
      });
    };
  });

});
