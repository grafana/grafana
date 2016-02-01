define([
  './datasource',
],
function (OpenTsDatasource) {
  'use strict';

  function metricsQueryEditor() {
    return {
      controller: 'OpenTSDBQueryCtrl',
      templateUrl: 'public/app/plugins/datasource/opentsdb/partials/query.editor.html',
    };
  }

  function configView() {
    return {templateUrl: 'public/app/plugins/datasource/opentsdb/partials/config.html'};
  }

  return {
    Datasource: OpenTsDatasource,
    metricsQueryEditor: metricsQueryEditor,
    configView: configView,
  };
});
