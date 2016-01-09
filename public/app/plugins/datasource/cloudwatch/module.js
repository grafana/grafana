define([
  'angular',
  './datasource',
  './query_parameter_ctrl',
],
function (angular, CloudWatchDatasource) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorCloudwatch', function() {
    return {controller: 'CloudWatchQueryCtrl', templateUrl: 'app/plugins/datasource/cloudwatch/partials/query.editor.html'};
  });

  module.directive('annotationsQueryEditorCloudwatch', function() {
    return {templateUrl: 'app/plugins/datasource/cloudwatch/partials/annotations.editor.html'};
  });

  module.directive('cloudwatchQueryParameter', function() {
    return {
      templateUrl: 'app/plugins/datasource/cloudwatch/partials/query.parameter.html',
      controller: 'CloudWatchQueryParameterCtrl',
      restrict: 'E',
      scope: {
        target: "=",
        datasourceName: "@",
        onChange: "&",
      }
    };
  });

  module.directive('datasourceCustomSettingsViewCloudwatch', function() {
    return {templateUrl: 'app/plugins/datasource/cloudwatch/partials/edit_view.html'};
  });

  return  {
    Datasource: CloudWatchDatasource
  };
});
