define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorBosun', function() {
    return {
      controller: 'BosunQueryCtrl',
      templateUrl: 'app/plugins/datasource/bosun/partials/query.editor.html',
    };
  });

});
