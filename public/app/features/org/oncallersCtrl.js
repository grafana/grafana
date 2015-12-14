define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallersCtrl', function($scope, oncallerMgrSrv, oncallerSrv) {
    oncallerMgrSrv.load().then(function onSuccess(response) {
      $scope.oncallerDefList = response.data;
    }, function onFailed(response) {
      $scope.err = response.message || "Request failed";
      $scope.status = response.status;
    });

    /*
    $scope.oncallerDefList = ﻿[ {
      "service" : "com.test",
      "name" : "Song",
      "email" : "wsonguci@gmail.com",
      "tel" : "9498856398",
      "carrier" : "tmobile",
    } ];
    */

    $scope.remove = function(oncallerService) {
      oncallerMgrSrv.remove(oncallerService).then(function onSuccess() {
        for (var i = $scope.oncallerDefList.length - 1; i >= 0; i--) {
          if (oncallerService === $scope.oncallerDefList[i].service) {
            $scope.oncallerDefList.splice(i, 1);
            break;
          }
        }
      }, function onFailed(response) {
        oncallerSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };
  });
});
