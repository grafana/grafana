import _ from 'lodash';
import { auto } from 'angular';

export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode: boolean;
  error?: string | null;
  isLastQuery: boolean;

  constructor(public $scope: any, public $injector: auto.IInjectorService) {
    this.panel = this.panelCtrl.panel;
    this.isLastQuery = _.indexOf(this.panel.targets, this.target) === this.panel.targets.length - 1;
  }

  refresh() {
    this.panelCtrl.refresh();
  }
}
