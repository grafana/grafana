import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { PanelEvents } from '@grafana/data';

export interface MssqlQuery {
  refId: string;
  format: string;
  alias: string;
  rawSql: string;
}

export interface QueryMeta {
  sql: string;
}

const defaultQuery = `SELECT
  $__timeEpoch(<time_column>),
  <value column> as value,
  <series name column> as metric
FROM
  <table name>
WHERE
  $__timeFilter(time_column)
ORDER BY
  <time_column> ASC`;

export class MssqlQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  showLastQuerySQL: boolean;
  formats: any[];
  target: MssqlQuery;
  lastQueryMeta: QueryMeta;
  lastQueryError: string;
  showHelp: boolean;

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService) {
    super($scope, $injector);

    this.target.format = this.target.format || 'time_series';
    this.target.alias = '';
    this.formats = [
      { text: 'Time series', value: 'time_series' },
      { text: 'Table', value: 'table' },
    ];

    if (!this.target.rawSql) {
      // special handling when in table panel
      if (this.panelCtrl.panel.type === 'table') {
        this.target.format = 'table';
        this.target.rawSql = 'SELECT 1';
      } else {
        this.target.rawSql = defaultQuery;
      }
    }

    this.panelCtrl.events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on(PanelEvents.dataError, this.onDataError.bind(this), $scope);
  }

  onDataReceived(dataList: any) {
    this.lastQueryMeta = null;
    this.lastQueryError = null;

    const anySeriesFromQuery: any = _.find(dataList, { refId: this.target.refId });
    if (anySeriesFromQuery) {
      this.lastQueryMeta = anySeriesFromQuery.meta;
    }
  }

  onDataError(err: any) {
    if (err.data && err.data.results) {
      const queryRes = err.data.results[this.target.refId];
      if (queryRes) {
        this.lastQueryMeta = queryRes.meta;
        this.lastQueryError = queryRes.error;
      }
    }
  }
}
