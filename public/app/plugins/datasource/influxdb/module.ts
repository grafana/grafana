import {InfluxDatasource} from './datasource';
import {InfluxQueryCtrl} from './query_ctrl';

class InfluxConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/influxdb/partials/config.html';
}

class InfluxQueryOptionsCtrl {
  static templateUrl = 'public/app/plugins/datasource/influxdb/partials/query.options.html';
}

class InfluxAnnotationsQueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/influxdb/partials/annotations.editor.html';
}

export {
  InfluxDatasource as Datasource,
  InfluxQueryCtrl as QueryCtrl,
  InfluxConfigCtrl as ConfigCtrl,
  InfluxQueryOptionsCtrl as QueryOptionsCtrl,
  InfluxAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

// define([
//   './datasource',
// ],
// function (InfluxDatasource) {
//   'use strict';
//
//   function influxMetricsQueryEditor() {
//     return {controller: 'InfluxQueryCtrl', templateUrl: 'public/app/plugins/datasource/influxdb/partials/query.editor.html'};
//   }
//
//   function influxMetricsQueryOptions() {
//     return {templateUrl: 'public/app/plugins/datasource/influxdb/partials/query.options.html'};
//   }
//
//   function influxAnnotationsQueryEditor() {
//     return {templateUrl: 'public/app/plugins/datasource/influxdb/partials/annotations.editor.html'};
//   }
//
//   function influxConfigView() {
//     return {templateUrl: 'public/app/plugins/datasource/influxdb/partials/config.html'};
//   }
//
//   return {
//     Datasource:               InfluxDatasource,
//     metricsQueryEditor:       influxMetricsQueryEditor,
//     metricsQueryOptions:      influxMetricsQueryOptions,
//     annotationsQueryEditor:   influxAnnotationsQueryEditor,
//     configView:               influxConfigView,
//   };
// });
