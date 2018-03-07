///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode: boolean;
  error: string;

  constructor(public $scope, private $injector) {
    this.panel = this.panelCtrl.panel;
  }

  refresh() {
    this.panelCtrl.refresh();
  }

}

