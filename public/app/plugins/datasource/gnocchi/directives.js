define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorGnocchi', function() {
    return {controller: 'GnocchiQueryCtrl', templateUrl: 'app/plugins/datasource/gnocchi/partials/query.editor.html'};
  });

});
