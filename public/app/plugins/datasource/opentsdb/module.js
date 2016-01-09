define([
  'angular',
  './datasource',
],
function (angular, OpenTsDatasource) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorOpentsdb', function() {
    return {
      controller: 'OpenTSDBQueryCtrl',
      templateUrl: 'app/plugins/datasource/opentsdb/partials/query.editor.html',
    };
  });

  module.directive('datasourceCustomSettingsViewOpentsdb', function() {
    return {templateUrl: 'app/plugins/datasource/opentsdb/partials/config.html'};
  });

  return {
    Datasource: OpenTsDatasource
  };
});
