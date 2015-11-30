define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorKairosdb', function() {
    return {controller: 'KairosDBQueryCtrl', templateUrl: 'app/plugins/datasource/kairosdb/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsKairosdb', function() {
    return {templateUrl: 'app/plugins/datasource/kairosdb/partials/query.options.html'};
  });

});
