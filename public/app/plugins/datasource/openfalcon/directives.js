define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorOpenfalcon', function() {
    return {controller: 'OpenfalconQueryCtrl', templateUrl: 'app/plugins/datasource/openfalcon/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsOpenfalcon', function() {
    return {templateUrl: 'app/plugins/datasource/openfalcon/partials/query.options.html'};
  });

  module.directive('annotationsQueryEditorOpenfalcon', function() {
    return {templateUrl: 'app/plugins/datasource/openfalcon/partials/annotations.editor.html'};
  });

});