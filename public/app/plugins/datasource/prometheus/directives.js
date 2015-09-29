define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorPrometheus', function() {
    return {controller: 'PrometheusQueryCtrl', templateUrl: 'app/plugins/datasource/prometheus/partials/query.editor.html'};
  });

});
