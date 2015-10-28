define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorPostgres', function() {
    return {templateUrl: 'app/plugins/datasource/postgres/partials/query.editor.html'};
  });

});
