import _ from 'lodash';
import appEvents from 'app/core/app_events';
import { MysqlMetaQuery } from './meta_query';
import { QueryCtrl } from 'app/plugins/sdk';
import { SqlPart } from 'app/core/components/sql_part/sql_part';
import MysqlQuery from './mysql_query';
import sqlPart from './sql_part';
import { auto } from 'angular';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CoreEvents } from 'app/types';
import { PanelEvents } from '@grafana/data';
import { VariableWithMultiSupport } from 'app/features/variables/types';
import { getLocationSrv } from '@grafana/runtime';

export interface QueryMeta {
  sql: string;
}

const defaultQuery = `SELECT
  UNIX_TIMESTAMP(<time_column>) as time_sec,
  <value column> as value,
  <series name column> as metric
FROM <table name>
WHERE $__timeFilter(time_column)
ORDER BY <time_column> ASC
`;

export class MysqlQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  formats: any[];
  lastQueryError: string | null;
  showHelp: boolean;

  queryModel: MysqlQuery;
  metaBuilder: MysqlMetaQuery;
  tableSegment: any;
  whereAdd: any;
  timeColumnSegment: any;
  metricColumnSegment: any;
  selectMenu: any[];
  selectParts: SqlPart[][];
  groupParts: SqlPart[];
  whereParts: SqlPart[];
  groupAdd: any;

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private templateSrv: TemplateSrv,
    private uiSegmentSrv: any
  ) {
    super($scope, $injector);

    this.target = this.target;
    this.queryModel = new MysqlQuery(this.target, templateSrv, this.panel.scopedVars);
    this.metaBuilder = new MysqlMetaQuery(this.target, this.queryModel);
    this.updateProjection();

    this.formats = [
      { text: 'Time series', value: 'time_series' },
      { text: 'Table', value: 'table' },
    ];

    if (!this.target.rawSql) {
      // special handling when in table panel
      if (this.panelCtrl.panel.type === 'table') {
        this.target.format = 'table';
        this.target.rawSql = 'SELECT 1';
        this.target.rawQuery = true;
      } else {
        this.target.rawSql = defaultQuery;
        this.datasource.metricFindQuery(this.metaBuilder.findMetricTable()).then((result: any) => {
          if (result.length > 0) {
            this.target.table = result[0].text;
            let segment = this.uiSegmentSrv.newSegment(this.target.table);
            this.tableSegment.html = segment.html;
            this.tableSegment.value = segment.value;

            this.target.timeColumn = result[1].text;
            segment = this.uiSegmentSrv.newSegment(this.target.timeColumn);
            this.timeColumnSegment.html = segment.html;
            this.timeColumnSegment.value = segment.value;

            this.target.timeColumnType = 'timestamp';
            this.target.select = [[{ type: 'column', params: [result[2].text] }]];
            this.updateProjection();
            this.updateRawSqlAndRefresh();
          }
        });
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

    this.panelCtrl.events.on(PanelEvents.dataReceived, this.onDataReceived.bind(this), $scope);
    this.panelCtrl.events.on(PanelEvents.dataError, this.onDataError.bind(this), $scope);
  }

  showQueryInspector() {
    getLocationSrv().update({
      query: { inspect: this.panel.id, inspectTab: 'query' },
      partial: true,
    });
  }

  updateRawSqlAndRefresh() {
    if (!this.target.rawQuery) {
      this.target.rawSql = this.queryModel.buildQuery();
    }

    this.panelCtrl.refresh();
  }

  updateProjection() {
    this.selectParts = _.map(this.target.select, (parts: any) => {
      return _.map(parts, sqlPart.create).filter(n => n);
    });
    this.whereParts = _.map(this.target.where, sqlPart.create).filter(n => n);
    this.groupParts = _.map(this.target.group, sqlPart.create).filter(n => n);
  }

  updatePersistedParts() {
    this.target.select = _.map(this.selectParts, selectParts => {
      return _.map(selectParts, (part: any) => {
        return { type: part.def.type, datatype: part.datatype, params: part.params };
      });
    });
    this.target.where = _.map(this.whereParts, (part: any) => {
      return { type: part.def.type, datatype: part.datatype, name: part.name, params: part.params };
    });
    this.target.group = _.map(this.groupParts, (part: any) => {
      return { type: part.def.type, datatype: part.datatype, params: part.params };
    });
  }

  buildSelectMenu() {
    this.selectMenu = [];
    const aggregates = {
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

    this.selectMenu.push(aggregates);
    this.selectMenu.push({ text: 'Alias', value: 'alias' });
    this.selectMenu.push({ text: 'Column', value: 'column' });
  }

  toggleEditorMode() {
    if (this.target.rawQuery) {
      appEvents.emit(CoreEvents.showConfirmModal, {
        title: 'Warning',
        text2: 'Switching to query builder may overwrite your raw SQL.',
        icon: 'exclamation-triangle',
        yesText: 'Switch',
        onConfirm: () => {
          this.target.rawQuery = !this.target.rawQuery;
        },
      });
    } else {
      this.target.rawQuery = !this.target.rawQuery;
    }
  }

  resetPlusButton(button: { html: any; value: any }) {
    const plusButton = this.uiSegmentSrv.newPlusButton();
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
    this.target.where = [];
    this.target.group = [];
    this.updateProjection();

    const segment = this.uiSegmentSrv.newSegment('none');
    this.metricColumnSegment.html = segment.html;
    this.metricColumnSegment.value = segment.value;
    this.target.metricColumn = 'none';

    const task1 = this.datasource.metricFindQuery(this.metaBuilder.buildColumnQuery('time')).then((result: any) => {
      // check if time column is still valid
      if (result.length > 0 && !_.find(result, (r: any) => r.text === this.target.timeColumn)) {
        const segment = this.uiSegmentSrv.newSegment(result[0].text);
        this.timeColumnSegment.html = segment.html;
        this.timeColumnSegment.value = segment.value;
      }
      return this.timeColumnChanged(false);
    });
    const task2 = this.datasource.metricFindQuery(this.metaBuilder.buildColumnQuery('value')).then((result: any) => {
      if (result.length > 0) {
        this.target.select = [[{ type: 'column', params: [result[0].text] }]];
        this.updateProjection();
      }
    });

    Promise.all([task1, task2]).then(() => {
      this.updateRawSqlAndRefresh();
    });
  }

  getTimeColumnSegments() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildColumnQuery('time'))
      .then(this.transformToSegments({}))
      .catch(this.handleQueryError.bind(this));
  }

  timeColumnChanged(refresh?: boolean) {
    this.target.timeColumn = this.timeColumnSegment.value;
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildDatatypeQuery(this.target.timeColumn))
      .then((result: any) => {
        if (result.length === 1) {
          if (this.target.timeColumnType !== result[0].text) {
            this.target.timeColumnType = result[0].text;
          }
          let partModel;
          if (this.queryModel.hasUnixEpochTimecolumn()) {
            partModel = sqlPart.create({ type: 'macro', name: '$__unixEpochFilter', params: [] });
          } else {
            partModel = sqlPart.create({ type: 'macro', name: '$__timeFilter', params: [] });
          }

          if (this.whereParts.length >= 1 && this.whereParts[0].def.type === 'macro') {
            // replace current macro
            this.whereParts[0] = partModel;
          } else {
            this.whereParts.splice(0, 0, partModel);
          }
        }

        this.updatePersistedParts();
        if (refresh !== false) {
          this.updateRawSqlAndRefresh();
        }
      });
  }

  getMetricColumnSegments() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildColumnQuery('metric'))
      .then(this.transformToSegments({ addNone: true }))
      .catch(this.handleQueryError.bind(this));
  }

  metricColumnChanged() {
    this.target.metricColumn = this.metricColumnSegment.value;
    this.updateRawSqlAndRefresh();
  }

  onDataReceived(dataList: any) {
    this.lastQueryError = null;
  }

  onDataError(err: any) {
    if (err.data && err.data.results) {
      const queryRes = err.data.results[this.target.refId];
      if (queryRes) {
        this.lastQueryError = queryRes.error;
      }
    }
  }

  transformToSegments(config: any) {
    return (results: any) => {
      const segments = _.map(results, segment => {
        return this.uiSegmentSrv.newSegment({
          value: segment.text,
          expandable: segment.expandable,
        });
      });

      if (config.addTemplateVars) {
        for (const variable of this.templateSrv.getVariables()) {
          let value;
          value = '$' + variable.name;
          if (config.templateQuoter && ((variable as unknown) as VariableWithMultiSupport).multi === false) {
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

  findAggregateIndex(selectParts: any) {
    return _.findIndex(selectParts, (p: any) => p.def.type === 'aggregate' || p.def.type === 'percentile');
  }

  findWindowIndex(selectParts: any) {
    return _.findIndex(selectParts, (p: any) => p.def.type === 'window' || p.def.type === 'moving_window');
  }

  addSelectPart(selectParts: any[], item: { value: any }, subItem: { type: any; value: any }) {
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
        const parts = _.map(selectParts, (part: any) => {
          return sqlPart.create({ type: part.def.type, params: _.clone(part.params) });
        });
        this.selectParts.push(parts);
        break;
      case 'percentile':
      case 'aggregate':
        // add group by if no group by yet
        if (this.target.group.length === 0) {
          this.addGroup('time', '$__interval');
        }
        const aggIndex = this.findAggregateIndex(selectParts);
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
        const windowIndex = this.findWindowIndex(selectParts);
        if (windowIndex !== -1) {
          // replace current window function
          selectParts[windowIndex] = partModel;
        } else {
          const aggIndex = this.findAggregateIndex(selectParts);
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
      partModel = sqlPart.create({ type: 'alias', params: [selectParts[0].params[0].replace(/"/g, '')] });
      if (selectParts[selectParts.length - 1].def.type === 'alias') {
        selectParts[selectParts.length - 1] = partModel;
      } else {
        selectParts.push(partModel);
      }
    }

    this.updatePersistedParts();
    this.updateRawSqlAndRefresh();
  }

  removeSelectPart(selectParts: any, part: { def: { type: string } }) {
    if (part.def.type === 'column') {
      // remove all parts of column unless its last column
      if (this.selectParts.length > 1) {
        const modelsIndex = _.indexOf(this.selectParts, selectParts);
        this.selectParts.splice(modelsIndex, 1);
      }
    } else {
      const partIndex = _.indexOf(selectParts, part);
      selectParts.splice(partIndex, 1);
    }

    this.updatePersistedParts();
  }

  handleSelectPartEvent(selectParts: any, part: { def: any }, evt: { name: any }) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (part.def.type) {
          // case 'aggregate':
          //   return this.datasource
          //     .metricFindQuery(this.metaBuilder.buildAggregateQuery())
          //     .then(this.transformToSegments({}))
          //     .catch(this.handleQueryError.bind(this));
          case 'column':
            return this.datasource
              .metricFindQuery(this.metaBuilder.buildColumnQuery('value'))
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
        }
      }
      case 'part-param-changed': {
        this.updatePersistedParts();
        this.updateRawSqlAndRefresh();
        break;
      }
      case 'action': {
        this.removeSelectPart(selectParts, part);
        this.updateRawSqlAndRefresh();
        break;
      }
      case 'get-part-actions': {
        return Promise.resolve([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  handleGroupPartEvent(part: any, index: any, evt: { name: any }) {
    switch (evt.name) {
      case 'get-param-options': {
        return this.datasource
          .metricFindQuery(this.metaBuilder.buildColumnQuery())
          .then(this.transformToSegments({}))
          .catch(this.handleQueryError.bind(this));
      }
      case 'part-param-changed': {
        this.updatePersistedParts();
        this.updateRawSqlAndRefresh();
        break;
      }
      case 'action': {
        this.removeGroup(part, index);
        this.updateRawSqlAndRefresh();
        break;
      }
      case 'get-part-actions': {
        return Promise.resolve([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  addGroup(partType: string, value: string) {
    let params = [value];
    if (partType === 'time') {
      params = ['$__interval', 'none'];
    }
    const partModel = sqlPart.create({ type: partType, params: params });

    if (partType === 'time') {
      // put timeGroup at start
      this.groupParts.splice(0, 0, partModel);
    } else {
      this.groupParts.push(partModel);
    }

    // add aggregates when adding group by
    for (const selectParts of this.selectParts) {
      if (!selectParts.some(part => part.def.type === 'aggregate')) {
        const aggregate = sqlPart.create({ type: 'aggregate', params: ['avg'] });
        selectParts.splice(1, 0, aggregate);
        if (!selectParts.some(part => part.def.type === 'alias')) {
          const alias = sqlPart.create({ type: 'alias', params: [selectParts[0].part.params[0]] });
          selectParts.push(alias);
        }
      }
    }

    this.updatePersistedParts();
  }

  removeGroup(part: { def: { type: string } }, index: number) {
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

  handleWherePartEvent(whereParts: any, part: any, evt: any, index: any) {
    switch (evt.name) {
      case 'get-param-options': {
        switch (evt.param.name) {
          case 'left':
            return this.datasource
              .metricFindQuery(this.metaBuilder.buildColumnQuery())
              .then(this.transformToSegments({}))
              .catch(this.handleQueryError.bind(this));
          case 'right':
            if (['int', 'bigint', 'double', 'datetime'].indexOf(part.datatype) > -1) {
              // don't do value lookups for numerical fields
              return Promise.resolve([]);
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
            return Promise.resolve(this.uiSegmentSrv.newOperators(this.metaBuilder.getOperators(part.datatype)));
          default:
            return Promise.resolve([]);
        }
      }
      case 'part-param-changed': {
        this.updatePersistedParts();
        this.datasource.metricFindQuery(this.metaBuilder.buildDatatypeQuery(part.params[0])).then((d: any) => {
          if (d.length === 1) {
            part.datatype = d[0].text;
          }
        });
        this.updateRawSqlAndRefresh();
        break;
      }
      case 'action': {
        // remove element
        whereParts.splice(index, 1);
        this.updatePersistedParts();
        this.updateRawSqlAndRefresh();
        break;
      }
      case 'get-part-actions': {
        return Promise.resolve([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  getWhereOptions() {
    const options = [];
    if (this.queryModel.hasUnixEpochTimecolumn()) {
      options.push(this.uiSegmentSrv.newSegment({ type: 'macro', value: '$__unixEpochFilter' }));
    } else {
      options.push(this.uiSegmentSrv.newSegment({ type: 'macro', value: '$__timeFilter' }));
    }
    options.push(this.uiSegmentSrv.newSegment({ type: 'expression', value: 'Expression' }));
    return Promise.resolve(options);
  }

  addWhereAction(part: any, index: number) {
    switch (this.whereAdd.type) {
      case 'macro': {
        const partModel = sqlPart.create({ type: 'macro', name: this.whereAdd.value, params: [] });
        if (this.whereParts.length >= 1 && this.whereParts[0].def.type === 'macro') {
          // replace current macro
          this.whereParts[0] = partModel;
        } else {
          this.whereParts.splice(0, 0, partModel);
        }
        break;
      }
      default: {
        this.whereParts.push(sqlPart.create({ type: 'expression', params: ['value', '=', 'value'] }));
      }
    }

    this.updatePersistedParts();
    this.resetPlusButton(this.whereAdd);
    this.updateRawSqlAndRefresh();
  }

  getGroupOptions() {
    return this.datasource
      .metricFindQuery(this.metaBuilder.buildColumnQuery('group'))
      .then((tags: any) => {
        const options = [];
        if (!this.queryModel.hasTimeGroup()) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'time', value: 'time($__interval,none)' }));
        }
        for (const tag of tags) {
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
    this.updateRawSqlAndRefresh();
  }

  handleQueryError(err: any): any[] {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }
}
