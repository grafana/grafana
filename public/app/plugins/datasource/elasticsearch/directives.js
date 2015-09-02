define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('metricQueryEditorElasticsearch', function() {
    return {controller: 'ElasticQueryCtrl', templateUrl: 'app/plugins/datasource/elasticsearch/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsElasticsearch', function() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/query.options.html'};
  });

  module.directive('annotationsQueryEditorElasticsearch', function() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/annotations.editor.html'};
  });

});
