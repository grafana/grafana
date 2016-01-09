define([
  'angular',
  './datasource',
],
function (angular, PromDatasource) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorPrometheus', function() {
    return {controller: 'PrometheusQueryCtrl', templateUrl: 'app/plugins/datasource/prometheus/partials/query.editor.html'};
  });

  module.directive('datasourceCustomSettingsViewPrometheus', function() {
    return {templateUrl: 'app/plugins/datasource/prometheus/partials/config.html'};
  });

  return {
    Datasource: PromDatasource
  };
});
