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
        $scope.appEvent('alert-success', ['Dashboard saved', 'Saved as ' + $scope.clone.title]);

        $location.url('/dashboard/db/' + result.slug);

        $scope.appEvent('dashboard-saved', $scope.clone);
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
            title: 'Another dashboard with the same name exists',
            text: "Would you still like to save this dashboard?",
            yesText: "Save & Overwrite",
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
