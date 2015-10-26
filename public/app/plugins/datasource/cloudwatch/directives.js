define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorCloudwatch', function() {
    return {controller: 'CloudWatchQueryCtrl', templateUrl: 'app/plugins/datasource/cloudwatch/partials/query.editor.html'};
  });

  module.directive('annotationsQueryEditorCloudwatch', function() {
    return {templateUrl: 'app/plugins/datasource/cloudwatch/partials/annotations.editor.html'};
  });

});
