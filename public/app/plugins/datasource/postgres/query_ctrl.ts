import _ from 'lodash';
import appEvents from 'app/core/app_events';
import { PostgresMetaQuery } from './meta_query';
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
  metaBuilder: PostgresMetaQuery;
  lastQueryMeta: QueryMeta;
  lastQueryError: string;
  showHelp: boolean;
  tableSegment: any;
  whereAdd: any;
  timeColumnSegment: any;
  metricColumnSegment: any;
  selectMenu: any[];
  selectParts: SqlPart[][];
  groupParts: SqlPart[];
  whereParts: SqlPart[];
  groupAdd: any;

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv, private $q, private uiSegmentSrv) {
    super($scope, $injector);
    this.target = this.target;
    this.queryModel = new PostgresQuery(this.target, templateSrv, this.panel.scopedVars);
    this.metaBuilder = new PostgresMetaQuery(this.target, this.queryModel);
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

    if (!this.target.table) {
      this.tableSegment = uiSegmentSrv.newSegment({ value: 'select table', fake: true });
    } else {
      this.tableSegment = uiSegmentSrv.newSegment(this.target.table);
    }

    this.timeColumnSegment = uiSegmentSrv.newSegment(this.target.timeColumn);
    this.metricColumnSegment = uiSegmentSrv.newSegment(this.target.metricColumn);

    this.buildSelectMenu();
    this.whereAdd = this.uiSegmentSrv.newPlusButton();
    this.groupAdd = this.uiSegmentSrv.newPlusButton();

    this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
  }

  updateProjection() {
    this.selectParts = _.map(this.target.select, function(parts: any) {
      return _.map(parts, sqlPart.create).filter(n => n);
    });
    this.whereParts = _.map(this.target.where, sqlPart.create).filter(n => n);
    this.groupParts = _.map(this.target.group, sqlPart.create).filter(n => n);
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectParts, function(selectParts) {
      return _.map(selectParts, function(part: any) {
        return { type: part.def.type, params: part.params };
      });
    });
    this.target.where = _.map(this.whereParts, function(part: any) {
      return { type: part.def.type, name: part.name, params: part.params };
    });
    this.target.group = _.map(this.groupParts, function(part: any) {
      return { type: part.def.type, params: part.params };
    });
  }

  buildSelectMenu() {
    this.selectMenu = [];
    let aggregates = {
      text: 'Aggregate Functions',
      value: 'aggregate',
      submenu: [
        { text: 'Average', value: 'avg' },
        { text: 'Count', value: 'count' },
        { text: 'Maximum', value: 'max' },
        { text: 'Minimum', value: 'min' },
        { text: 'Sum', value: 'sum' },
        { text: 'Standard deviation', value: 'stddev' },
        { text: 'Variance', value: 'variance' },
      ],
    };

    // first and last aggregate are timescaledb specific
    if (this.datasource.jsonData.timescaledb === true) {
      aggregates.submenu.push({ text: 'First', value: 'first' });
      aggregates.submenu.push({ text: 'Last', value: 'last' });
    }

    this.selectMenu.push(aggregates);

    // ordered set aggregates require postgres 9.4+
    if (this.datasource.jsonData.postgresVersion >= 904) {
      let aggregates2 = {
        text: 'Ordered-Set Aggregate Functions',
        value: 'percentile',
        submenu: [
          { text: 'Percentile (continuous)', value: 'percentile_cont' },
          { text: 'Percentile (discrete)', value: 'percentile_disc' },
        ],
      };
      this.selectMenu.push(aggregates2);
    }

    let windows = {
      text: 'Window Functions',
      value: 'window',
      submenu: [
        { text: 'Increase', value: 'increase' },
        { text: 'Rate', value: 'rate' },
        { text: 'Sum', value: 'sum' },
        { text: 'Moving Average', value: 'avg', type: 'moving_window' },
      ],
    };
    this.selectMenu.push(windows);

    this.selectMenu.push({ text: 'Alias', value: 'alias' });
    this.selectMenu.push({ text: 'Column', value: 'column' });
  }

  toggleEditorMode() {
    if (this.target.rawQuery) {
      appEvents.emit('confirm-modal', {
        title: 'Warning',
        text2: 'Switching to query builder may overwrite your raw SQL.',
        icon: 'fa-exclamation',
        yesText: 'Switch',
        onConfirm: () => {
          this.target.rawQuery = !this.target.rawQuery;
        },
      });
    } else {
      this.target.rawQuery = !this.target.rawQuery;
    }
  }

  resetPlusButton(button) {
    let plusButton = this.uiSegmentSrv.newPlusButton();
    button.html = plusButton.html;
    button.value = plusButton.value;
  }

  getTableSegments() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildTableQuery())
      .then(this.transformToSegments({}))
      .catch(this.handleQueryError.bind(this));
  }

  tableChanged() {
    this.target.table = this.tableSegment.value;
    this.panelCtrl.refresh();
  }

  getTimeColumnSegments() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildColumnQuery('time'))
      .then(this.transformToSegments({}))
      .catch(this.handleQueryError.bind(this));
  }

  timeColumnChanged() {
    this.target.timeColumn = this.timeColumnSegment.value;
    this.datasource.metricFindQuery(this.metaBuilder.buildDatatypeQuery(this.target.timeColumn)).then(result => {
      if (result.length === 1) {
        this.target.timeColumnType = result[0];
      }
    });
    this.panelCtrl.refresh();
  }

  getMetricColumnSegments() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildColumnQuery('metric'))
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

  findAggregateIndex(selectParts) {
    return _.findIndex(selectParts, (p: any) => p.def.type === 'aggregate' || p.def.type === 'percentile');
  }

  findWindowIndex(selectParts) {
    return _.findIndex(selectParts, (p: any) => p.def.type === 'window' || p.def.type === 'moving_window');
  }

  addSelectPart(selectParts, item, subItem) {
    let partType = item.value;
    if (subItem && subItem.type) {
      partType = subItem.type;
    }
    let partModel = sqlPart.create({ type: partType });
    if (subItem) {
      partModel.params[0] = subItem.value;
    }
    let addAlias = false;

    switch (partType) {
      case 'column':
        let parts = _.map(selectParts, function(part: any) {
          return sqlPart.create({ type: part.def.type, params: _.clone(part.params) });
        });
        this.selectParts.push(parts);
        break;
      case 'percentile':
      case 'aggregate':
        // add group by if no group by yet
        if (this.target.group.length === 0) {
          this.addGroup('time', '1m');
        }
        let aggIndex = this.findAggregateIndex(selectParts);
        if (aggIndex !== -1) {
          // replace current aggregation
          selectParts[aggIndex] = partModel;
        } else {
          selectParts.splice(1, 0, partModel);
        }
        if (!_.find(selectParts, (p: any) => p.def.type === 'alias')) {
          addAlias = true;
        }
        break;
      case 'moving_window':
      case 'window':
        let windowIndex = this.findWindowIndex(selectParts);
        if (windowIndex !== -1) {
          // replace current window function
          selectParts[windowIndex] = partModel;
        } else {
          let aggIndex = this.findAggregateIndex(selectParts);
          if (aggIndex !== -1) {
            selectParts.splice(aggIndex + 1, 0, partModel);
          } else {
            selectParts.splice(1, 0, partModel);
          }
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
      if (this.selectParts.length > 1) {
        let modelsIndex = _.indexOf(this.selectParts, selectParts);
        this.selectParts.splice(modelsIndex, 1);
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
              .metricFindQuery(this.metaBuilder.buildAggregateQuery())
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
          case 'column':
            return this.datasource
              .metricFindQuery(this.metaBuilder.buildColumnQuery('value'))
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

  handleGroupPartEvent(part, index, evt) {
    switch (evt.name) {
      case 'get-param-options': {
        return this.datasource
          .metricFindQuery(this.metaBuilder.buildColumnQuery())
          .then(this.transformToSegments({}))
          .catch(this.handleQueryError.bind(this));
      }
      case 'part-param-changed': {
        this.panelCtrl.refresh();
        break;
      }
      case 'action': {
        this.removeGroup(part, index);
        this.panelCtrl.refresh();
        break;
      }
      case 'get-part-actions': {
        return this.$q.when([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  addGroup(partType, value) {
    let params = [value];
    if (partType === 'time') {
      params = ['1m', 'none'];
    }
    let partModel = sqlPart.create({ type: partType, params: params });

    if (partType === 'time') {
      // put timeGroup at start
      this.groupParts.splice(0, 0, partModel);
    } else {
      this.groupParts.push(partModel);
    }

    // add aggregates when adding group by
    for (let selectParts of this.selectParts) {
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

  removeGroup(part, index) {
    if (part.def.type === 'time') {
      // remove aggregations
      this.selectParts = _.map(this.selectParts, (s: any) => {
        return _.filter(s, (part: any) => {
          if (part.def.type === 'aggregate' || part.def.type === 'percentile') {
            return false;
          }
          return true;
        });
      });
    }

    this.groupParts.splice(index, 1);
    this.updatePersistedParts();
  }

  handleWherePartEvent(whereParts, part, evt, index) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (evt.param.name) {
          case 'left':
            return this.datasource
              .metricFindQuery(this.metaBuilder.buildColumnQuery())
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
          case 'right':
            if (['int4', 'int8', 'float4', 'float8', 'timestamp', 'timestamptz'].indexOf(part.datatype) > -1) {
              // don't do value lookups for numerical fields
              return this.$q.when([]);
            } else {
              return this.datasource
                .metricFindQuery(this.metaBuilder.buildValueQuery(part.params[0]))
                .then(
                  this.transformToSegments({
                    addTemplateVars: true,
                    templateQuoter: (v: string) => {
                      return this.queryModel.quoteLiteral(v);
                    },
                  })
                )
                .catch(this.handleQueryError.bind(this));
            }
          case 'op':
            return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN']));
          default:
            return this.$q.when([]);
        }
      }
      case 'part-param-changed': {
        this.datasource.metricFindQuery(this.metaBuilder.buildDatatypeQuery(part.params[0])).then((d: any) => {
          if (d.length === 1) {
            part.datatype = d[0].text;
          }
        });
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

  addWhereAction(part, index) {
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

  getGroupOptions() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildColumnQuery('group'))
      .then(tags => {
        var options = [];
        if (!this.queryModel.hasTimeGroup()) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'time', value: 'time(1m,none)' }));
        }
        for (let tag of tags) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'column', value: tag.text }));
        }
        return options;
      })
      .catch(this.handleQueryError.bind(this));
  }

  addGroupAction() {
    switch (this.groupAdd.value) {
      default: {
        this.addGroup(this.groupAdd.type, this.groupAdd.value);
      }
    }

    this.resetPlusButton(this.groupAdd);
    this.panelCtrl.refresh();
  }

  handleQueryError(err) {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }
}
