import {GrafanaDatasource} from './datasource';
import {QueryCtrl} from 'app/plugins/sdk';

class GrafanaQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
}

class GrafanaAnnotationsQueryCtrl {
  annotation: any;

  types = [
    {text: 'Panel', value: 'panel'},
    {text: 'Global', value: 'global'}
  ];

  constructor() {
    this.annotation.type = this.annotation.type || 'global';
    this.annotation.limit = this.annotation.limit || 100;
  }

  static templateUrl = 'partials/annotations.editor.html';
}

export {
  GrafanaDatasource,
  GrafanaDatasource as Datasource,
  GrafanaQueryCtrl as QueryCtrl,
  GrafanaAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};
