import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import queryPart from './query_part';
import PostgresQuery from './postgres_query';

export interface QueryMeta {
  sql: string;
}

const defaultQuery = `SELECT
  $__time(time_column),
  value1
FROM
  metric_table
WHERE
  $__timeFilter(time_column)
`;

export class PostgresQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  showLastQuerySQL: boolean;
  formats: any[];
  queryModel: PostgresQuery;
  lastQueryMeta: QueryMeta;
  lastQueryError: string;
  showHelp: boolean;
  schemaSegment: any;
  tableSegment: any;
  timeColumnSegment: any;
  selectMenu: any;

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv, private $q, private uiSegmentSrv) {
    super($scope, $injector);
    this.target = this.target;
    this.queryModel = new PostgresQuery(this.target, templateSrv, this.panel.scopedVars);

    this.formats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];

    if (!this.target.rawSql) {
      // special handling when in table panel
      if (this.panelCtrl.panel.type === 'table') {
        this.target.format = 'table';
        this.target.rawSql = 'SELECT 1';
      } else {
        this.target.rawSql = defaultQuery;
      }
    }

    this.schemaSegment= uiSegmentSrv.newSegment(this.target.schema);

    if (!this.target.table) {
      this.tableSegment = uiSegmentSrv.newSegment({value: 'select table',fake: true});
    } else {
      this.tableSegment= uiSegmentSrv.newSegment(this.target.table);
    }

    this.timeColumnSegment = uiSegmentSrv.newSegment(this.target.timeColumn);

    this.buildSelectMenu();
    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
  }

  buildSelectMenu() {
    var categories = queryPart.getCategories();
    this.selectMenu = _.reduce(
      categories,
      function(memo, cat, key) {
        var menu = {
          text: key,
          submenu: cat.map(item => {
            return { text: item.type, value: item.type };
          }),
        };
        memo.push(menu);
        return memo;
      },
      []
    );
  }

  toggleEditorMode() {
    try {
//      this.target.query = this.queryModel.render(false);
    } catch (err) {
      console.log('query render error');
    }
    this.target.rawQuery = !this.target.rawQuery;
  }

  getSchemaSegments() {
    var schemaQuery = "SELECT schema_name FROM information_schema.schemata WHERE";
    schemaQuery += " schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema';";
    return this.datasource
      .metricFindQuery(schemaQuery)
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getTableSegments() {
    var tableQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = '" + this.target.schema + "';";
    return this.datasource
      .metricFindQuery(tableQuery)
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getTimeColumnSegments() {
    var columnQuery = "SELECT column_name FROM information_schema.columns WHERE ";
    columnQuery += " table_schema = '" + this.target.schema + "'";
    columnQuery += " AND table_name = '" + this.target.table + "'";
    columnQuery += " AND data_type IN ('timestamp without time zone','timestamp with time zone','bigint','integer','double precision','real');";

    return this.datasource
      .metricFindQuery(columnQuery)
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getColumnSegments() {
    var columnQuery = "SELECT column_name FROM information_schema.columns WHERE ";
    columnQuery += " table_schema = '" + this.target.schema + "'";
    columnQuery += " AND table_name = '" + this.target.table + "'";
    columnQuery += " AND data_type IN ('bigint','integer','double precision','real');";

    return this.datasource
      .metricFindQuery(columnQuery)
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  tableChanged() {
    this.target.table = this.tableSegment.value;
    this.panelCtrl.refresh();
  }

  schemaChanged() {
    this.target.schema = this.schemaSegment.value;
    this.panelCtrl.refresh();
  }

  timeColumnChanged() {
    this.target.time = this.timeColumnSegment.value;
    this.panelCtrl.refresh();
  }

  onDataReceived(dataList) {
    this.lastQueryMeta = null;
    this.lastQueryError = null;

    let anySeriesFromQuery = _.find(dataList, { refId: this.target.refId });
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

  transformToSegments(addTemplateVars) {
    return results => {
      var segments = _.map(results, segment => {
        return this.uiSegmentSrv.newSegment({
          value: segment.text,
          expandable: segment.expandable,
        });
      });

      if (addTemplateVars) {
        for (let variable of this.templateSrv.variables) {
          segments.unshift(
            this.uiSegmentSrv.newSegment({
              type: 'template',
              value: '/^$' + variable.name + '$/',
              expandable: true,
            })
          );
        }
      }

      return segments;
    };
  }

  addSelectPart(selectParts, cat, subitem) {
    this.queryModel.addSelectPart(selectParts, subitem.value);
    this.panelCtrl.refresh();
  }

  handleSelectPartEvent(selectParts, part, evt) {
    switch (evt.name) {
      case 'get-param-options': {
        var columnQuery = "SELECT column_name FROM information_schema.columns WHERE ";
        columnQuery += " table_schema = '" + this.target.schema + "'";
        columnQuery += " AND table_name = '" + this.target.table + "'";
        columnQuery += " AND data_type IN ('bigint','integer','double precision','real');";

        return this.datasource
          .metricFindQuery(columnQuery)
          .then(this.transformToSegments(true))
          .catch(this.handleQueryError.bind(this));
      }
      case 'part-param-changed': {
        this.panelCtrl.refresh();
        break;
      }
      case 'action': {
        this.queryModel.removeSelectPart(selectParts, part);
        this.panelCtrl.refresh();
        break;
      }
      case 'get-part-actions': {
        return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  handleQueryError(err) {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }

}
