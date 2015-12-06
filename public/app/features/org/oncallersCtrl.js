define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallersCtrl', function($scope, oncallerMgrSrv, oncallerSrv) {
    /*
    oncallerMgrSrv.load().then(function onSuccess(response) {
      $scope.oncallerDefList = response.data;
    }, function onFailed(response) {
      $scope.err = response.message || "Request failed";
      $scope.status = response.status;
    });
    */
    $scope.oncallerDefList = [{
      "id" : "com.test:1948d9da-4a17-40c5-85e5-8885535e72fc",
      "service" : "com.test",
      "primaryName" : "Song Wang",
      "primaryEmail" : "wsonguci@gmail.com",
      "primaryPhone" : "9494366688",
      "primaryCarrier" : "tmobile"
    }, {
      "id" : "com.test:7c61b1dc-45f7-4700-936e-82bfb9b02849",
      "service" : "com.test",
      "primaryName" : "Yalei Wang",
      "primaryPhone" : "wangy1931@gmail.com",
      "primaryTel" : "4258947269",
      "primaryCarrier" : "verizon"
    }];

    $scope.remove = function(oncallerId) {
      oncallerMgrSrv.remove(oncallerId).then(function onSuccess() {
        for (var i = $scope.oncallerDefList.length - 1; i >= 0; i--) {
          if (oncallerId === $scope.oncallerDefList[i].id) {
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
