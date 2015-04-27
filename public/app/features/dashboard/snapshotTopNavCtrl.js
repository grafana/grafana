define([
  'angular',
  'moment',
],
function (angular, moment) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('SnapshotTopNavCtrl', function($scope) {

    $scope.init = function() {
      var meta = $scope.dashboardMeta;
      $scope.titleTooltip = 'Created: &nbsp;' + moment(meta.created).calendar();
      if (meta.expires) {
        $scope.titleTooltip += '<br>Expires: &nbsp;' + moment(meta.expires).fromNow() + '<br>';
      }
    };

    $scope.shareDashboard = function() {
      $scope.appEvent('show-modal', {
        src: './app/features/dashboard/partials/shareModal.html',
        scope: $scope.$new(),
      });
    };

  });

});
