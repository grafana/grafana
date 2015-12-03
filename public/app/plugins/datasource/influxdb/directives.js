define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorInfluxdb', function() {
    return {controller: 'InfluxQueryCtrl', templateUrl: 'app/plugins/datasource/influxdb/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsInfluxdb', function() {
    return {templateUrl: 'app/plugins/datasource/influxdb/partials/query.options.html'};
  });

  module.directive('annotationsQueryEditorInfluxdb', function() {
    return {templateUrl: 'app/plugins/datasource/influxdb/partials/annotations.editor.html'};
  });

});
