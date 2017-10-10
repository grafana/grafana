///<reference path="../../../headers/common.d.ts" />

import {coreModule} from 'app/core/core';
// import VirtualScroll from 'virtual-scroll';
// console.log(VirtualScroll);

export class RowOptionsCtrl {
  row: any;
  dashboard: any;
  rowCtrl: any;
  fontSizes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  conditions = ['Equals', 'Greater than', 'Less than', 'Include'];

  /** @ngInject */
  constructor() {
    this.row = this.rowCtrl.row;
    this.dashboard = this.rowCtrl.dashboard;
    this.row.titleSize = this.row.titleSize || 'h6';
  }
}

export function rowOptionsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/options.html',
    controller: RowOptionsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      rowCtrl: "=",
    },
  };
}

coreModule.directive('dashRowOptions', rowOptionsDirective);
