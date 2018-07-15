import _ from 'lodash';
import { PostgresQueryBuilder } from './query_builder';
import { QueryCtrl } from 'app/plugins/sdk';
import { SqlPart } from 'app/core/components/sql_part/sql_part';
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
  selectMenu: any[];
  selectModels: SqlPart[][];
  groupByParts: SqlPart[][];
  whereParts: SqlPart[][];
  groupByAdd: any;

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv, private $q, private uiSegmentSrv) {
    super($scope, $injector);
    this.target = this.target;
    this.queryModel = new PostgresQuery(this.target, templateSrv, this.panel.scopedVars);
    this.queryBuilder = new PostgresQueryBuilder(this.target, this.queryModel);
    this.updateProjection();

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
    this.whereAdd = this.uiSegmentSrv.newPlusButton();
    this.groupByAdd = this.uiSegmentSrv.newPlusButton();

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
  }

  updateProjection() {
    this.selectModels = _.map(this.target.select, function(parts: any) {
      return _.map(parts, sqlPart.create).filter(n => n);
    });
    this.whereParts = _.map(this.target.where, sqlPart.create).filter(n => n);
    this.groupByParts = _.map(this.target.groupBy, sqlPart.create).filter(n => n);
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectModels, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return { type: part.def.type, params: part.params };
      });
    });
    this.target.where = _.map(this.whereParts, function(part: any) {
      return { type: part.def.type, name: part.name, params: part.params };
    });
    this.target.groupBy = _.map(this.groupByParts, function(part: any) {
      return { type: part.def.type, params: part.params };
    });
  }

  buildSelectMenu() {
    this.selectMenu = [
      { text: 'Aggregate', value: 'aggregate' },
      { text: 'Special', value: 'special' },
      { text: 'Alias', value: 'alias' },
      { text: 'Column', value: 'column' },
    ];
  }

  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  resetPlusButton(button) {
    let plusButton = this.uiSegmentSrv.newPlusButton();
    button.html = plusButton.html;
    button.value = plusButton.value;
  }

  getSchemaSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildSchemaQuery())
      .then(this.transformToSegments({}))
      .catch(this.handleQueryError.bind(this));
  }

  schemaChanged() {
    this.target.schema = this.schemaSegment.value;
    this.panelCtrl.refresh();
  }

  getTableSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildTableQuery())
      .then(this.transformToSegments({}))
      .catch(this.handleQueryError.bind(this));
  }

  tableChanged() {
    this.target.table = this.tableSegment.value;
    this.panelCtrl.refresh();
  }

  getTimeColumnSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery('time'))
      .then(this.transformToSegments({}))
      .catch(this.handleQueryError.bind(this));
  }

  timeColumnChanged() {
    this.target.timeColumn = this.timeColumnSegment.value;
    this.panelCtrl.refresh();
  }

  getMetricColumnSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery('metric'))
      .then(this.transformToSegments({ addNone: true }))
      .catch(this.handleQueryError.bind(this));
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

  transformToSegments(config) {
    return results => {
      let segments = _.map(results, segment => {
        return this.uiSegmentSrv.newSegment({
          value: segment.text,
          expandable: segment.expandable,
        });
      });

      if (config.addTemplateVars) {
        for (let variable of this.templateSrv.variables) {
          let value;
          value = '$' + variable.name;
          if (config.templateQuoter && variable.multi === false) {
            value = config.templateQuoter(value);
          }

          segments.unshift(
            this.uiSegmentSrv.newSegment({
              type: 'template',
              value: value,
              expandable: true,
            })
          );
        }
      }

      if (config.addNone) {
        segments.unshift(this.uiSegmentSrv.newSegment({ type: 'template', value: 'none', expandable: true }));
      }

      return segments;
    };
  }

  addSelectPart(selectParts, item) {
    let partModel = sqlPart.create({ type: item.value });
    let addAlias = false;

    switch (item.value) {
      case 'column':
        let parts = _.map(selectParts, function(part: any) {
          return sqlPart.create({ type: part.def.type, params: _.clone(part.params) });
        });
        this.selectModels.push(parts);
        break;
      case 'aggregate':
      case 'special':
        let index = _.findIndex(selectParts, (p: any) => p.def.type === item.value);
        if (index !== -1) {
          selectParts[index] = partModel;
        } else {
          selectParts.splice(1, 0, partModel);
        }
        if (!_.find(selectParts, (p: any) => p.def.type === 'alias')) {
          addAlias = true;
        }
        break;
      case 'alias':
        addAlias = true;
        break;
    }

    if (addAlias) {
      // set initial alias name to column name
      partModel = sqlPart.create({ type: 'alias', params: [selectParts[0].params[0]] });
      if (selectParts[selectParts.length - 1].def.type === 'alias') {
        selectParts[selectParts.length - 1] = partModel;
      } else {
        selectParts.push(partModel);
      }
    }

    this.updatePersistedParts();
    this.panelCtrl.refresh();
  }

  removeSelectPart(selectParts, part) {
    if (part.def.type === 'column') {
      // remove all parts of column unless its last column
      if (this.selectModels.length > 1) {
        let modelsIndex = _.indexOf(this.selectModels, selectParts);
        this.selectModels.splice(modelsIndex, 1);
      }
    } else {
      let partIndex = _.indexOf(selectParts, part);
      selectParts.splice(partIndex, 1);
    }

    this.updatePersistedParts();
  }

  handleSelectPartEvent(selectParts, part, evt) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (part.def.type) {
          case 'aggregate':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildAggregateQuery())
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
          case 'column':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildColumnQuery('value'))
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
        }
      }
      case 'part-param-changed': {
        this.panelCtrl.refresh();
        break;
      }
      case 'action': {
        this.removeSelectPart(selectParts, part);
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
          .then(this.transformToSegments({}))
          .catch(this.handleQueryError.bind(this));
      }
      case 'part-param-changed': {
        this.panelCtrl.refresh();
        break;
      }
      case 'action': {
        this.removeGroupBy(part, index);
        this.panelCtrl.refresh();
        break;
      }
      case 'get-part-actions': {
        return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  addGroupBy(partType, value) {
    let params = [value];
    if (partType === 'time') {
      params = ['1m', 'none'];
    }
    let partModel = sqlPart.create({ type: partType, params: params });

    if (partType === 'time') {
      // put timeGroup at start
      this.groupByParts.splice(0, 0, partModel);
    } else {
      this.groupByParts.push(partModel);
    }

    // add aggregates when adding group by
    for (let selectParts of this.selectModels) {
      if (!selectParts.some(part => part.def.type === 'aggregate')) {
        let aggregate = sqlPart.create({ type: 'aggregate', params: ['avg'] });
        selectParts.splice(1, 0, aggregate);
        if (!selectParts.some(part => part.def.type === 'alias')) {
          let alias = sqlPart.create({ type: 'alias', params: [selectParts[0].part.params[0]] });
          selectParts.push(alias);
        }
      }
    }

    this.updatePersistedParts();
  }

  removeGroupBy(part, index) {
    if (part.def.type === 'time') {
      // remove aggregations
      this.selectModels = _.map(this.selectModels, (s: any) => {
        return _.filter(s, (part: any) => {
          if (part.def.type === 'aggregate') {
            return false;
          }
          return true;
        });
      });
    }

    this.groupByParts.splice(index, 1);
    this.updatePersistedParts();
  }

  handleWherePartEvent(whereParts, part, evt, index) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (evt.param.name) {
          case 'left':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildColumnQuery())
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
          case 'right':
            return this.datasource
              .metricFindQuery(this.queryBuilder.buildValueQuery(part.params[0]))
              .then(this.transformToSegments({ addTemplateVars: true, templateQuoter: this.queryModel.quoteLiteral }))
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
        // remove element
        whereParts.splice(index, 1);
        this.updatePersistedParts();
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
    options.push(this.uiSegmentSrv.newSegment({ type: 'macro', value: '$__timeFilter' }));
    // options.push(this.uiSegmentSrv.newSegment({ type: 'macro', value: '$__unixEpochFilter' }));
    options.push(this.uiSegmentSrv.newSegment({ type: 'expression', value: 'Expression' }));
    return this.$q.when(options);
  }

  whereAddAction(part, index) {
    switch (this.whereAdd.type) {
      case 'macro': {
        this.whereParts.push(sqlPart.create({ type: 'macro', name: this.whereAdd.value, params: [] }));
        break;
      }
      default: {
        this.whereParts.push(sqlPart.create({ type: 'expression', params: ['value', '=', 'value'] }));
      }
    }

    this.updatePersistedParts();
    this.resetPlusButton(this.whereAdd);
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
    switch (this.groupByAdd.value) {
      default: {
        this.addGroupBy(this.groupByAdd.type, this.groupByAdd.value);
      }
    }

    this.resetPlusButton(this.groupByAdd);
    this.panelCtrl.refresh();
  }

  handleQueryError(err) {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }
}
