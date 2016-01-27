define([
  './datasource',
  './edit_view',
  './bucket_agg',
  './metric_agg',
],
function (ElasticDatasource, editView) {
  'use strict';

  function metricsQueryEditor() {
    return {controller: 'ElasticQueryCtrl', templateUrl: 'app/plugins/datasource/elasticsearch/partials/query.editor.html'};
  }

  function metricsQueryOptions() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/query.options.html'};
  }

  function annotationsQueryEditor() {
    return {templateUrl: 'app/plugins/datasource/elasticsearch/partials/annotations.editor.html'};
  }

  return {
    Datasource: ElasticDatasource,
    configView: editView.default,
    annotationsQueryEditor: annotationsQueryEditor,
    metricsQueryEditor: metricsQueryEditor,
    metricsQueryOptions: metricsQueryOptions,
  };

});
