///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {GrafanaDatasource} from './datasource';

class GrafanaMetricsQueryEditor {
  static templateUrl = 'public/app/plugins/datasource/grafana/partials/query.editor.html';
}

export {
  GrafanaDatasource,
  GrafanaDatasource as Datasource,
  GrafanaMetricsQueryEditor as MetricsQueryEditor,
};

