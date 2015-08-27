define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorOpennms', function() {
    return {
      controller: 'OpenNMSQueryCtrl',
      templateUrl: 'app/plugins/datasource/opennms/partials/query.editor.html',
    };

  });

});