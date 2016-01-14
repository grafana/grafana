define([
  './datasource',
],
function (GraphiteDatasource) {
  'use strict';

  function metricsQueryEditor() {
    return {controller: 'GraphiteQueryCtrl', templateUrl: 'app/plugins/datasource/graphite/partials/query.editor.html'};
  }

  function metricsQueryOptions() {
    return {templateUrl: 'app/plugins/datasource/graphite/partials/query.options.html'};
  }

  function annotationsQueryEditor() {
    return {templateUrl: 'app/plugins/datasource/graphite/partials/annotations.editor.html'};
  }

  function configView() {
    return {templateUrl: 'app/plugins/datasource/graphite/partials/config.html'};
  }

  return {
    Datasource: GraphiteDatasource,
    configView: configView,
    annotationsQueryEditor: annotationsQueryEditor,
    metricsQueryEditor: metricsQueryEditor,
    metricsQueryOptions: metricsQueryOptions,
  };
});
