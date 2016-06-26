define([
  'angular',
  'app/core/utils/file_export'
],
function (angular, fileExport) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ExportCsvCtrl', function($scope) {

    $scope.init = function() {
      $scope.exportTzAvail = {
        "-12:00": "UTC−12:00",
        "-11:00": "UTC−11:00",
        "-10:00": "UTC−10:00",
        "-09:30": "UTC−09:30",
        "-09:00": "UTC−09:00",
        "-08:00": "UTC−08:00",
        "-07:00": "UTC−07:00",
        "-06:00": "UTC−06:00",
        "-05:00": "UTC−05:00",
        "-04:00": "UTC−04:00",
        "-03:30": "UTC−03:30",
        "-03:00": "UTC−03:00",
        "-02:00": "UTC−02:00",
        "-01:00": "UTC−01:00",
        "00:00": "UTC",
        "browser": "Browser Timezone",
        "+01:00": "UTC+01:00",
        "+02:00": "UTC+02:00",
        "+03:00": "UTC+03:00",
        "+03:30": "UTC+03:30",
        "+04:00": "UTC+04:00",
        "+04:30": "UTC+04:30",
        "+05:00": "UTC+05:00",
        "+05:30": "UTC+05:30",
        "+05:45": "UTC+05:45",
        "+06:00": "UTC+06:00",
        "+06:30": "UTC+06:30",
        "+07:00": "UTC+07:00",
        "+08:00": "UTC+08:00",
        "+08:30": "UTC+08:30",
        "+08:45": "UTC+08:45",
        "+09:00": "UTC+09:00",
        "+09:30": "UTC+09:30",
        "+10:00": "UTC+10:00",
        "+10:30": "UTC+10:30",
        "+11:00": "UTC+11:00",
        "+12:00": "UTC+12:00",
        "+12:45": "UTC+12:45",
        "+13:00": "UTC+13:00",
        "+14:00": "UTC+14:00"
      };

      $scope.exportTz = '00:00';

      $scope.exportModesAvail = {
        'rows': 'Rows',
        'cols': 'Columns'
      };
      $scope.exportMode = 'rows';
    };

    $scope.offsetTz = function() {
      if ($scope.exportTz === 'browser') {
        // Reverse the timezone offset for moment.js, which is used in the fileExport
        return (new Date().getTimezoneOffset()) * -1;
      }

      return $scope.exportTz;
    };

    $scope.exportCsv = function() {
      if ($scope.exportMode === 'cols') {
        fileExport.exportSeriesListToCsvColumns(this.seriesList, $scope.offsetTz());
      } else {
        fileExport.exportSeriesListToCsv(this.seriesList, $scope.offsetTz());
      }
    };

  });

});
