define([
  './datasource',
],
function (PromDatasource) {
  'use strict';

  function metricsQueryEditor() {
    return {controller: 'PrometheusQueryCtrl', templateUrl: 'app/plugins/datasource/prometheus/partials/query.editor.html'};
  }

  function configView() {
    return {templateUrl: 'app/plugins/datasource/prometheus/partials/config.html'};
  }

  return {
    Datasource: PromDatasource,
    metricsQueryEditor: metricsQueryEditor,
    configView: configView,
  };
});
