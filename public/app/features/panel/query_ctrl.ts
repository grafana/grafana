import _ from 'lodash';
import { QueryType } from '@grafana/ui';

export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode: boolean;
  error: string;
  isLastQuery: boolean;
  queryType: QueryType;

  constructor(public $scope, public $injector) {
    this.panel = this.panelCtrl.panel;
    this.isLastQuery = _.indexOf(this.panel.targets, this.target) === this.panel.targets.length - 1;

    if (!this.queryType) {
      this.queryType = QueryType.Metrics;
    }
  }

  refresh() {
    this.panelCtrl.refresh();
  }
}
