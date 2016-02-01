///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {GrafanaDatasource} from './datasource';

var module = angular.module('grafana.directives');

function grafanaMetricsQueryEditor() {
  return {templateUrl: 'app/plugins/datasource/grafana/partials/query.editor.html'};
}

export class MetricsQueryEditor {
  panelCtrl: any;
  target: any;
}

class GrafanaMetricsQueryEditor extends MetricsQueryEditor {
  static templateUrl = 'app/plugins/datasource/grafana/partials/query.editor.html';

  constructor() {
    super();
    console.log('this is a metrics editor', this.panelCtrl, this.target);
  }
}

export {
  GrafanaDatasource,
  GrafanaDatasource as Datasource,
  GrafanaMetricsQueryEditor as MetricsQueryEditor,
};

