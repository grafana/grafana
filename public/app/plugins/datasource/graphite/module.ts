import {GraphiteDatasource} from './datasource';
import {GraphiteQueryCtrl} from './query_ctrl';

class GraphiteConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/graphite/partials/config.html';
}

class GraphiteQueryOptionsCtrl {
  static templateUrl = 'public/app/plugins/datasource/graphite/partials/query.options.html';
}


export {
  GraphiteDatasource as Datasource,
  GraphiteQueryCtrl as QueryCtrl,
  GraphiteConfigCtrl as ConfigCtrl,
  GraphiteQueryOptionsCtrl as QueryOptionsCtrl,
};

// define([
//   './datasource',
// ],
// function (GraphiteDatasource) {
//   'use strict';
//
//   function metricsQueryEditor() {
//     return {
//       controller: 'GraphiteQueryCtrl',
//       templateUrl: 'public/app/plugins/datasource/graphite/partials/query.editor.html'
//     };
//   }
//
//   function metricsQueryOptions() {
//     return {templateUrl: 'public/app/plugins/datasource/graphite/partials/query.options.html'};
//   }
//
//   function annotationsQueryEditor() {
//     return {templateUrl: 'public/app/plugins/datasource/graphite/partials/annotations.editor.html'};
//   }
//
//   function configView() {
//     return {templateUrl: 'public/app/plugins/datasource/graphite/partials/config.html'};
//   }
//
//   function ConfigView() {
//   }
//   ConfigView.templateUrl = 'public/app/plugins/datasource/graphite/partials/config.html';
//
//   return {
//     Datasource: GraphiteDatasource,
//     configView: configView,
//     annotationsQueryEditor: annotationsQueryEditor,
//     metricsQueryEditor: metricsQueryEditor,
//     metricsQueryOptions: metricsQueryOptions,
//     ConfigView: ConfigView
//   };
// });
