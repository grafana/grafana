define([
  './datasource',
],
function (OpenFalconDatasource) {
  'use strict';

  function metricsQueryEditor() {
    return {controller: 'OpenFalconQueryCtrl', templateUrl: 'app/plugins/datasource/openfalcon/partials/query.editor.html'};
  }

  function metricsQueryOptions() {
    return {templateUrl: 'app/plugins/datasource/openfalcon/partials/query.options.html'};
  }

  function annotationsQueryEditor() {
    return {templateUrl: 'app/plugins/datasource/openfalcon/partials/annotations.editor.html'};
  }

  function configView() {
    return {templateUrl: 'app/plugins/datasource/openfalcon/partials/config.html'};
  }

  return {
    Datasource: OpenFalconDatasource,
    configView: configView,
    annotationsQueryEditor: annotationsQueryEditor,
    metricsQueryEditor: metricsQueryEditor,
    metricsQueryOptions: metricsQueryOptions,
  };
});
