///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class SnapshotsCtrl {

  /** @ngInject */
  constructor(backendSrv, $scope) {
    $scope.init = function() {
      backendSrv.get('/api/dashboard/snapshots').then(function(result) {
        $scope.snapshots = result;
      });
    };

    $scope.removeSnapshot = function(snapshot) {
      $scope.appEvent('confirm-modal', {
        title: 'Confirm delete snapshot',
        text: 'Are you sure you want to delete snapshot ' + snapshot.name + '?',
        yesText: "Delete",
        icon: "fa-warning",
        onConfirm: function() {
          $scope.removeSnapshotConfirmed(snapshot);
        }
      });
    };

    $scope.removeSnapshotConfirmed = function(snapshot) {
      _.remove($scope.snapshots, {key: snapshot.key});
      backendSrv.get('/api/snapshots-delete/' + snapshot.deleteKey)
      .then(function() {
        $scope.appEvent('alert-success', ['Snapshot deleted', '']);
      }, function() {
        $scope.appEvent('alert-error', ['Unable to delete snapshot', '']);
        $scope.snapshots.push(snapshot);
      });
    };

    $scope.init();
  }
}
  
angular.module('grafana.controllers').controller('SnapshotsCtrl', SnapshotsCtrl);
