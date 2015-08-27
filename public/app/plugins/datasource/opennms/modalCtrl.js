define([
    'angular',
    'lodash'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('OpenNMSModalSelectionCtrl', function ($scope) {
      $scope.searchForRows = function () {
        $scope.searching = true;
        $scope.search($scope.query)
          .then(function (results) {
            // Reset the selected row
            $scope.selectedRow = null;
            // Add the results to the scope
            $scope.rows = results.rows;
            $scope.count = results.count;
            $scope.totalCount = results.totalCount;
            // We're done
            $scope.searching = false;
          }, function () {
            $scope.searching = false;
          });
      };

      $scope.setClickedRow = function (index) {
        if ($scope.selectedRow === index) {
          $scope.selectedRow = null;
        } else {
          $scope.selectedRow = index;
          // Keep a reference to the row when the selection is made
          $scope.row = $scope.rows[$scope.selectedRow];
        }
      };

      $scope.cancel = function () {
        $scope.deferred.reject();
      };

      $scope.ok = function () {
        if ($scope.selectedRow !== null) {
          $scope.deferred.resolve($scope.row);
        } else {
          $scope.deferred.reject();
        }
      };

      (function () {
        $scope.query = "";
        $scope.searchForRows();

        $scope.selectedRow = null;
      })();
    });
  });