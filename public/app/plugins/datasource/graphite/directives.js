define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorGraphite', function() {
    return {controller: 'GraphiteQueryCtrl', templateUrl: 'app/plugins/datasource/graphite/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsGraphite', function() {
    return {templateUrl: 'app/plugins/datasource/graphite/partials/query.options.html'};
  });

  module.directive('annotationsQueryEditorGraphite', function() {
    return {templateUrl: 'app/plugins/datasource/graphite/partials/annotations.editor.html'};
  });

});
