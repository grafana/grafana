define([
    'angular',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SnoozeCtrl', function ($scope, backendSrv) {
      var snooze_url = "/alert/status/snooze";
      $scope.init = function () {
        $scope.snoozeMin = "120";
        $scope.moreMinutes = {
          "10": "10分钟",
          "30": "半小时",
          "60": "一小时",
          "120": "两小时",
          "360": "六小时",
          "720": "半天"
        };

        $scope.snooze = function () {
          var relativeMin = (new Date().getTime() - $scope.alertDetails.status.levelChangedTime)/60000;
          $scope.alertDetails.status.snoozeMinutes = relativeMin + parseInt($scope.snoozeMin);

          backendSrv.alertD({
            method: "post",
            url: snooze_url,
            params: {
              "id": $scope.alertDetails.status.alertId,
              "host": $scope.alertDetails.status.monitoredEntity,
              "moreMinutes": $scope.snoozeMin
            }
          });
          $scope.dismiss();
        };
      };
    });
  });
