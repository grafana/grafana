define([
  'angular',
  '../core_module',
],
function (angular, coreModule) {
  'use strict';

  coreModule.default.controller('JsonEditorCtrl', function($scope) {

    $scope.json = angular.toJson($scope.object, true);
    $scope.canUpdate = $scope.updateHandler !== void 0;

    $scope.update = function () {
      var newObject = angular.fromJson($scope.json);
      $scope.updateHandler(newObject, $scope.object);
    };

  });

});
