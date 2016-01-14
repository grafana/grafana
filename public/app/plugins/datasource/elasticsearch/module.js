define([
  'angular',
  './datasource',
  './edit_view',
  './bucket_agg',
  './metric_agg',
],
function (angular, ElasticDatasource, editView) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('elasticMetricAgg', function() {
    return {
      templateUrl: 'app/plugins/datasource/elasticsearch/partials/metric_agg.html',
      controller: 'ElasticMetricAggCtrl',
      restrict: 'E',
      scope: {
        target: "=",
        index: "=",
        onChange: "&",
        getFields: "&",
        esVersion: '='
      }
    };
  });

  module.directive('elasticBucketAgg', function() {
    return {
      templateUrl: 'app/plugins/datasource/elasticsearch/partials/bucket_agg.html',
      controller: 'ElasticBucketAggCtrl',
      restrict: 'E',
      scope: {
        target: "=",
        index: "=",
        onChange: "&",
        getFields: "&",
      }
    };
  });

  module.directive('metricQueryEditorElasticsearch', function() {
    return {controller: 'ElasticQueryCtrl', templateUrl: 'app/plugins/datasource/elasticsearch/partials/query.editor.html'};
  });

  module.directive('metricQueryOptionsElasticsearch', function() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/query.options.html'};
  });

  function annotationsQueryEditor() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/annotations.editor.html'};
  }

  return {
    Datasource: ElasticDatasource,
    configView: editView.default,
    annotationsQueryEditor: annotationsQueryEditor,
  };

});
