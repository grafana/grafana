import _ from 'lodash';
import { PostgresQueryBuilder } from './query_builder';
import { QueryCtrl } from 'app/plugins/sdk';
import PostgresQuery from './postgres_query';
import sqlPart from './sql_part';

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
  queryBuilder: PostgresQueryBuilder;
  lastQueryMeta: QueryMeta;
  lastQueryError: string;
  showHelp: boolean;
  schemaSegment: any;
  tableSegment: any;
  whereAdd: any;
  timeColumnSegment: any;
  metricColumnSegment: any;
  selectMenu: any;
  groupBySegment: any;

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv, private $q, private uiSegmentSrv) {
    super($scope, $injector);
    this.target = this.target;
    this.queryModel = new PostgresQuery(this.target, templateSrv, this.panel.scopedVars);
    this.queryBuilder = new PostgresQueryBuilder(this.target, this.queryModel);

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

    this.schemaSegment = uiSegmentSrv.newSegment(this.target.schema);

    if (!this.target.table) {
      this.tableSegment = uiSegmentSrv.newSegment({ value: 'select table', fake: true });
    } else {
      this.tableSegment = uiSegmentSrv.newSegment(this.target.table);
    }

    this.timeColumnSegment = uiSegmentSrv.newSegment(this.target.timeColumn);
    this.metricColumnSegment = uiSegmentSrv.newSegment(this.target.metricColumn);

    this.buildSelectMenu();
    this.buildWhereSegments();
    this.whereAdd = this.uiSegmentSrv.newPlusButton();
    this.groupBySegment = this.uiSegmentSrv.newPlusButton();

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
  }

  buildSelectMenu() {
    this.selectMenu = [
      { text: 'Aggregate', value: 'aggregate' },
      { text: 'Math', value: 'math' },
      { text: 'Alias', value: 'alias' },
      { text: 'Column', value: 'column' },
    ];
  }

  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  getSchemaSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildSchemaQuery())
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getTableSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildTableQuery())
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getTimeColumnSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery('time'))
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getMetricColumnSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery('metric'))
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
    this.target.timeColumn = this.timeColumnSegment.value;
    this.panelCtrl.refresh();
  }

  metricColumnChanged() {
    this.target.metricColumn = this.metricColumnSegment.value;
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
              value: '$' + variable.name,
              expandable: true,
            })
          );
        }
      }

      return segments;
    };
  }

  addSelectPart(selectParts, cat, subitem) {
    if ('submenu' in cat) {
      this.queryModel.addSelectPart(selectParts, subitem.value);
    } else {
      this.queryModel.addSelectPart(selectParts, cat.value);
    }
    this.panelCtrl.refresh();
  }

  handleSelectPartEvent(selectParts, part, evt) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (part.def.type) {
          case 'aggregate':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildAggregateQuery())
              .then(this.transformToSegments(false))
              .catch(this.handleQueryError.bind(this));
          case 'column':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildColumnQuery('value'))
              .then(this.transformToSegments(true))
              .catch(this.handleQueryError.bind(this));
        }
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

  handleGroupByPartEvent(part, index, evt) {
    switch (evt.name) {
      case 'get-param-options': {
        return this.datasource
          .metricFindQuery(this.queryBuilder.buildColumnQuery())
          .then(this.transformToSegments(true))
          .catch(this.handleQueryError.bind(this));
      }
      case 'part-param-changed': {
        this.panelCtrl.refresh();
        break;
      }
      case 'action': {
        this.queryModel.removeGroupByPart(part, index);
        this.panelCtrl.refresh();
        break;
      }
      case 'get-part-actions': {
        return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  buildWhereSegments() {
    //    this.whereSegments = [];
    //    this.whereSegments.push(sqlPart.create({ type: 'expression', params: ['value', '=', 'value'] }));
  }

  handleWherePartEvent(whereParts, part, evt, index) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (evt.param.name) {
          case 'left':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildColumnQuery())
              .then(this.transformToSegments(false))
              .catch(this.handleQueryError.bind(this));
          case 'right':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildValueQuery(part.params[0]))
              .then(this.transformToSegments(true))
              .catch(this.handleQueryError.bind(this));
          case 'op':
            return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', '<', '<=', '>', '>=', 'IN']));
          default:
            return this.$q.when([]);
        }
      }
      case 'part-param-changed': {
        this.panelCtrl.refresh();
        break;
      }
      case 'action': {
        this.queryModel.removeWherePart(part, index);
        this.panelCtrl.refresh();
        break;
      }
      case 'get-part-actions': {
        return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  getWhereOptions() {
    var options = [];
    options.push(this.uiSegmentSrv.newSegment({ type: 'function', value: '$__timeFilter' }));
    options.push(this.uiSegmentSrv.newSegment({ type: 'function', value: '$__unixEpochFilter' }));
    options.push(this.uiSegmentSrv.newSegment({ type: 'function', value: 'Expression' }));
    return this.$q.when(options);
  }

  whereAddAction(part, index) {
    switch (this.whereAdd.type) {
      case 'macro': {
        this.queryModel.whereParts.push(
          sqlPart.create({ type: 'function', name: this.whereAdd.value, params: ['value', '=', 'value'] })
        );
      }
      default: {
        this.queryModel.whereParts.push(sqlPart.create({ type: 'expression', params: ['value', '=', 'value'] }));
      }
    }
    this.whereAdd = this.uiSegmentSrv.newPlusButton();
    this.panelCtrl.refresh();
  }

  getGroupByOptions() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery())
      .then(tags => {
        var options = [];
        if (!this.queryModel.hasGroupByTime()) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'time', value: 'time(1m,none)' }));
        }
        for (let tag of tags) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'column', value: tag.text }));
        }
        return options;
      })
      .catch(this.handleQueryError.bind(this));
  }

  groupByAction() {
    switch (this.groupBySegment.value) {
      default: {
        this.queryModel.addGroupBy(this.groupBySegment.value);
      }
    }

    var plusButton = this.uiSegmentSrv.newPlusButton();
    this.groupBySegment.value = plusButton.value;
    this.groupBySegment.html = plusButton.html;
    this.panelCtrl.refresh();
  }

  handleQueryError(err) {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }
}
