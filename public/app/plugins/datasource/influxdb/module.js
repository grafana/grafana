define([
  'angular',
  './datasource',
],
function (angular, InfluxDatasource) {
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

  module.directive('datasourceCustomSettingsViewInfluxdb', function() {
    return {templateUrl: 'app/plugins/datasource/influxdb/partials/config.html'};
  });

  return {
    Datasource: InfluxDatasource
  };
});
