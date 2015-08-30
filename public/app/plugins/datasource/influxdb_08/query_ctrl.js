define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  var seriesList = null;

  module.controller('InfluxQueryCtrl_08', function($scope, $timeout) {

    $scope.init = function() {
      var target = $scope.target;

      target.function = target.function || 'mean';
      target.column = target.column || 'value';

      // backward compatible correction of schema
      if (target.condition_value) {
        target.condition = target.condition_key + ' ' + target.condition_op + ' ' + target.condition_value;
        delete target.condition_key;
        delete target.condition_op;
        delete target.condition_value;
      }

      if (target.groupby_field_add === false) {
        target.groupby_field = '';
        delete target.groupby_field_add;
      }

      $scope.functions = [
        'count', 'mean', 'sum', 'min',
        'max', 'mode', 'distinct', 'median',
        'derivative', 'stddev', 'first', 'last',
        'difference'
      ];

      $scope.operators = ['=', '=~', '>', '<', '!~', '<>'];
      $scope.oldSeries = target.series;
      $scope.$on('typeahead-updated', function() {
        $timeout($scope.get_data);
      });
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    // Cannot use typeahead and ng-change on blur at the same time
    $scope.seriesBlur = function() {
      if ($scope.oldSeries !== $scope.target.series) {
        $scope.oldSeries = $scope.target.series;
        $scope.columnList = null;
        $scope.get_data();
      }
    };

    $scope.changeFunction = function(func) {
      $scope.target.function = func;
      $scope.get_data();
    };

    // called outside of digest
    $scope.listColumns = function(query, callback) {
      if (!$scope.columnList) {
        $scope.$apply(function() {
          $scope.datasource.listColumns($scope.target.series).then(function(columns) {
            $scope.columnList = columns;
            callback(columns);
          });
        });
      }
      else {
        return $scope.columnList;
      }
    };

    $scope.listSeries = function(query, callback) {
      if (query !== '') {
        seriesList = [];
        $scope.datasource.listSeries(query).then(function(series) {
          seriesList = series;
          callback(seriesList);
        });
      }
      else {
        return seriesList;
      }
    };

<<<<<<< 67dec8109256b22dadc31650bf94a36e9018db13:public/app/plugins/datasource/influxdb_08/query_ctrl.js
    $scope.init();

=======
>>>>>>> fix(datasource query editors): fixed issue with duplicate query and the query letter (refId):public/app/plugins/datasource/influxdb_08/queryCtrl.js
  });
});
