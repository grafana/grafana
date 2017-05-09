define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorClouderamanager', function() {
    return {controller: 'CDHQueryCtrl', templateUrl: 'app/plugins/datasource/clouderamanager/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsClouderamanager', function() {
    return {templateUrl: 'app/plugins/datasource/clouderamanager/partials/query.options.html'};
  });

});
