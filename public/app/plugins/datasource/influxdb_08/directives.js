define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorInfluxdb08', function() {
    return {controller: 'InfluxQueryCtrl_08', templateUrl: 'app/plugins/datasource/influxdb_08/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsInfluxdb08', function() {
    return {templateUrl: 'app/plugins/datasource/influxdb_08/partials/query.options.html'};
  });

  module.directive('annotationsQueryEditorInfluxdb08', function() {
    return {templateUrl: 'app/plugins/datasource/influxdb_08/partials/annotations.editor.html'};
  });

});
