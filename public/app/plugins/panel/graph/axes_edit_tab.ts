///<reference path="../../../headers/common.d.ts" />

export class AxesEditTabCtrl {
  panel: any;
  panelCtrl: any;

  /** @ngInject **/
  constructor($scope) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    $scope.ctrl = this;
  }

}

/** @ngInject **/
export function axesTabCtrl() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/graph/tab_axes.html',
    controller: AxesEditTabCtrl,
  };
}
