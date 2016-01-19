define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SnapshotsCtrl', function($scope, $location, backendSrv) {
    backendSrv.get('/api/dashboard/snapshots')
      .then(function(result) {
        $scope.snapshots = result;
      });

    $scope.removeSnapshotConfirmed = function(snapshot) {
      _.remove($scope.snapshots, {Key: snapshot.Key});

      backendSrv.get('/api/snapshots-delete/' + snapshot.DeleteKey)
      .then(function() {
        $scope.appEvent('alert-success', ['Snapshot deleted', '']);
      }, function() {
        $scope.appEvent('alert-error', ['Unable to delete snapshot', '']);
        $scope.snapshots.push(snapshot);
      });
    };

    $scope.removeSnapshot = function(snapshot) {

      $scope.appEvent('confirm-modal', {
        title: 'Confirm delete snapshot',
        text: 'Are you sure you want to delete snapshot ' + snapshot.Name + '?',
        yesText: "Delete",
        icon: "fa-warning",
        onConfirm: function() {
          $scope.removeSnapshotConfirmed(snapshot);
        }
      });

    };

  });
});
