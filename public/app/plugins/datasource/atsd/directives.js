define([
  'angular',
],
function (angular) {
  'use strict';
  
  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorAtsd', function() {
    return {
      controller: 'AtsdQueryCtrl',
      templateUrl: 'app/plugins/datasource/atsd/partials/query.editor.html',
    };
  });

});
