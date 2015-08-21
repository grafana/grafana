define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorGrafana', function() {
    return {templateUrl: 'app/plugins/datasource/grafana/partials/query.editor.html'};
  });

});
