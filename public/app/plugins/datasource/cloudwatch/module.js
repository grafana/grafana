define([
  './datasource',
  './query_parameter_ctrl',
  './query_ctrl',
],
function (CloudWatchDatasource) {
  'use strict';

  function metricsQueryEditor() {
    return {controller: 'CloudWatchQueryCtrl', templateUrl: 'app/plugins/datasource/cloudwatch/partials/query.editor.html'};
  }

  function annotationsQueryEditor() {
    return {templateUrl: 'app/plugins/datasource/cloudwatch/partials/annotations.editor.html'};
  }

  function configView() {
    return {templateUrl: 'app/plugins/datasource/cloudwatch/partials/edit_view.html'};
  }

  return  {
    Datasource: CloudWatchDatasource,
    configView: configView,
    annotationsQueryEditor: annotationsQueryEditor,
    metricsQueryEditor: metricsQueryEditor,
  };
});
