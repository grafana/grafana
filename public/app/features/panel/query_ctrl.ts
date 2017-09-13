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
  isLastQuery: boolean;

  constructor(public $scope, private $injector) {
    this.panel = this.panelCtrl.panel;
    this.isLastQuery = _.indexOf(this.panel.targets, this.target) === (this.panel.targets.length - 1);
  }

  refresh() {
    this.panelCtrl.refresh();
  }

}

