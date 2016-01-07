define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('sample.directives');

  module.directive('metricQueryEditorGrafana', function() {
    return {templateUrl: 'app/plugins/datasource/sample/partials/query.editor.html'};
  });

});
