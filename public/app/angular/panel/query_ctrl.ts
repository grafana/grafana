import { auto } from 'angular';
import { indexOf } from 'lodash';

export class QueryCtrl<T = any> {
  target!: T;
  datasource!: any;
  panelCtrl!: any;
  panel: any;
  hasRawMode!: boolean;
  error?: string | null;
  isLastQuery: boolean;

  constructor(public $scope: any, public $injector: auto.IInjectorService) {
    this.panelCtrl = this.panelCtrl ?? $scope.ctrl.panelCtrl;
    this.target = this.target ?? $scope.ctrl.target;
    this.datasource = this.datasource ?? $scope.ctrl.datasource;
    this.panel = this.panelCtrl?.panel ?? $scope.ctrl.panelCtrl.panel;
    this.isLastQuery = indexOf(this.panel.targets, this.target) === this.panel.targets.length - 1;
  }

  refresh() {
    this.panelCtrl.refresh();
  }
}
