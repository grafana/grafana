///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

export interface CassandraQuery {
  refId: string;
  format: string;
  alias: string;
  rawSql: string;
}

export interface QueryMeta {
  sql: string;
}


const defaultQuery = `SELECT
  toUnixTimestamp(<time_column>) as time_ms,
  <value column> as value,
  <series name column> as metric
FROM <table name>
WHERE $__timeFilter(time_column)
`;

export class CassandraQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  showLastQuerySQL: boolean;
  formats: any[];
  target: CassandraQuery;
  lastQueryMeta: QueryMeta;
  lastQueryError: string;
  showHelp: boolean;

  /** @ngInject **/
  constructor($scope, $injector) {
    super($scope, $injector);

    this.target.format = this.target.format || 'time_series';
    this.target.alias = "";
    this.formats = [
      {text: 'Time series', value: 'time_series'},
      {text: 'Table', value: 'table'},
    ];

    if (!this.target.rawSql) {

      // special handling when in table panel
      if (this.panelCtrl.panel.type === 'table') {
        this.target.format = 'table';
        this.target.rawSql = "select now() from system.local";
      } else {
        this.target.rawSql = defaultQuery;
      }
    }

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
  }

  onDataReceived(dataList) {
    this.lastQueryMeta = null;
    this.lastQueryError = null;

    let anySeriesFromQuery = _.find(dataList, {refId: this.target.refId});
    if (anySeriesFromQuery) {
      this.lastQueryMeta = anySeriesFromQuery.meta;
    }
  }

  onDataError(err) {
    if (err.data && err.data.results) {
      let queryRes = err.data.results[this.target.refId];
      if (queryRes) {
        this.lastQueryMeta = queryRes.meta;
        this.lastQueryError = queryRes.error;
      }
    }
  }
}


