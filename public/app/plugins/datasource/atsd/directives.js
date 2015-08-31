define([
  'angular',
],
function (angular) {
  'use strict';
  
  console.log('ATSD');

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorAtsd', function() {
    console.log('ATSD in');
    return {
      controller: 'AtsdQueryCtrl',
      templateUrl: 'app/plugins/datasource/atsd/partials/query.editor.html',
    };
  });

});
