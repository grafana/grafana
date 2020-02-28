import _ from 'lodash';
import angular, { auto } from 'angular';

export class QueryCtrl implements angular.IComponentController {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode: boolean;
  error: string;
  isLastQuery: boolean;

  constructor(public $scope: any, public $injector: auto.IInjectorService) {}

  $onInit() {
    this.panel = this.panelCtrl.panel;
    this.isLastQuery = _.indexOf(this.panel.targets, this.target) === this.panel.targets.length - 1;
  }

  refresh() {
    this.panelCtrl.refresh();
  }
}
