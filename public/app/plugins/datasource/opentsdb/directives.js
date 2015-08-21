define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorOpentsdb', function() {
    return {
      controller: 'OpenTSDBQueryCtrl',
      templateUrl: 'app/plugins/datasource/opentsdb/partials/query.editor.html',
    };
  });

});
