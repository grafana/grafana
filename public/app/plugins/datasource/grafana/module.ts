///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {GrafanaDatasource} from './datasource';
import {QueryCtrl} from 'app/features/panel/panel';

class GrafanaQueryCtrl extends QueryCtrl {
  static templateUrl = 'public/app/plugins/datasource/grafana/partials/query.editor.html';
}

export {
  GrafanaDatasource,
  GrafanaDatasource as Datasource,
  GrafanaQueryCtrl as QueryCtrl,
};

