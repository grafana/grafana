import angular from 'angular';
import _ from 'lodash';
import { PostgresQueryBuilder } from './query_builder';
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
  queryBuilder: PostgresQueryBuilder;
  lastQueryMeta: QueryMeta;
  lastQueryError: string;
  showHelp: boolean;
  schemaSegment: any;
  tableSegment: any;
  whereSegments: any;
  timeColumnSegment: any;
  metricColumnSegment: any;
  selectMenu: any;
  groupBySegment: any;
  removeWhereFilterSegment: any;

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

    this.schemaSegment= uiSegmentSrv.newSegment(this.target.schema);

    if (!this.target.table) {
      this.tableSegment = uiSegmentSrv.newSegment({value: 'select table',fake: true});
    } else {
      this.tableSegment= uiSegmentSrv.newSegment(this.target.table);
    }

    this.timeColumnSegment = uiSegmentSrv.newSegment(this.target.timeColumn);
    this.metricColumnSegment = uiSegmentSrv.newSegment(this.target.metricColumn);

    this.buildSelectMenu();
    this.whereSegments = [];
    for (let tag of this.target.where) {
      if (!tag.operator) {
        if (/^\/.*\/$/.test(tag.value)) {
          tag.operator = '=~';
        } else {
          tag.operator = '=';
        }
      }

      if (tag.condition) {
        this.whereSegments.push(uiSegmentSrv.newCondition(tag.condition));
      }

      this.whereSegments.push(uiSegmentSrv.newKey(tag.key));
      this.whereSegments.push(uiSegmentSrv.newOperator(tag.operator));
      this.whereSegments.push(uiSegmentSrv.newKeyValue(tag.value));
    }

    this.fixWhereSegments();
    this.groupBySegment = this.uiSegmentSrv.newPlusButton();

    this.removeWhereFilterSegment = uiSegmentSrv.newSegment({
      fake: true,
      value: '-- remove filter --',
    });
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
      .metricFindQuery(this.queryBuilder.buildColumnQuery("time"))
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  getMetricColumnSegments() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery("metric"))
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
    this.queryModel.addSelectPart(selectParts, subitem.value);
    this.panelCtrl.refresh();
  }

  handleSelectPartEvent(selectParts, part, evt) {
    switch (evt.name) {
      case 'get-param-options': {
        return this.datasource
          .metricFindQuery(this.queryBuilder.buildColumnQuery("value"))
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

  fixWhereSegments() {
    var count = this.whereSegments.length;
    var lastSegment = this.whereSegments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  getTagsOrValues(segment, index) {
    if (segment.type === 'condition') {
      return this.$q.when([this.uiSegmentSrv.newSegment('AND'), this.uiSegmentSrv.newSegment('OR')]);
    }
    if (segment.type === 'operator') {
      var nextValue = this.whereSegments[index + 1].value;
      if (/^\/.*\/$/.test(nextValue)) {
        return this.$q.when(this.uiSegmentSrv.newOperators(['=~', '!~']));
      } else {
        return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', '<>', '<', '>']));
      }
    }

    var query, addTemplateVars;
    if (segment.type === 'key' || segment.type === 'plus-button') {
      query = this.queryBuilder.buildColumnQuery();

      addTemplateVars = false;
    } else if (segment.type === 'value') {
      query = this.queryBuilder.buildValueQuery(this.whereSegments[index -2].value);
      addTemplateVars = true;
    }

    return this.datasource
      .metricFindQuery(query)
      .then(this.transformToSegments(addTemplateVars))
      .then(results => {
        if (segment.type === 'key') {
          results.splice(0, 0, angular.copy(this.removeWhereFilterSegment));
        }
        return results;
      })
      .catch(this.handleQueryError.bind(this));
  }

  getTagValueOperator(tagValue, tagOperator): string {
    if (tagOperator !== '=~' && tagOperator !== '!~' && /^\/.*\/$/.test(tagValue)) {
      return '=~';
    } else if ((tagOperator === '=~' || tagOperator === '!~') && /^(?!\/.*\/$)/.test(tagValue)) {
      return '=';
    }
    return null;
  }

  whereSegmentUpdated(segment, index) {
    this.whereSegments[index] = segment;

    // handle remove where condition
    if (segment.value === this.removeWhereFilterSegment.value) {
      this.whereSegments.splice(index, 3);
      if (this.whereSegments.length === 0) {
        this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
      } else if (this.whereSegments.length > 2) {
        this.whereSegments.splice(Math.max(index - 1, 0), 1);
        if (this.whereSegments[this.whereSegments.length - 1].type !== 'plus-button') {
          this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
        }
      }
    } else {
      if (segment.type === 'plus-button') {
        if (index > 2) {
          this.whereSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
        }
        this.whereSegments.push(this.uiSegmentSrv.newOperator('='));
        this.whereSegments.push(this.uiSegmentSrv.newFake('select value', 'value', 'query-segment-value'));
        segment.type = 'key';
        segment.cssClass = 'query-segment-key';
      }

      if (index + 1 === this.whereSegments.length) {
        this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
      }
    }

    this.rebuildTargetWhereConditions();
  }

  rebuildTargetWhereConditions() {
    var where = [];
    var tagIndex = 0;
    var tagOperator = '';

    _.each(this.whereSegments, (segment2, index) => {
      if (segment2.type === 'key') {
        if (where.length === 0) {
          where.push({});
        }
        where[tagIndex].key = segment2.value;
      } else if (segment2.type === 'value') {
        tagOperator = this.getTagValueOperator(segment2.value, where[tagIndex].operator);
        if (tagOperator) {
          this.whereSegments[index - 1] = this.uiSegmentSrv.newOperator(tagOperator);
          where[tagIndex].operator = tagOperator;
        }
        where[tagIndex].value = segment2.value;
      } else if (segment2.type === 'condition') {
        where.push({ condition: segment2.value });
        tagIndex += 1;
      } else if (segment2.type === 'operator') {
        where[tagIndex].operator = segment2.value;
      }
    });

    this.target.where = where;
    this.panelCtrl.refresh();
  }

  getGroupByOptions() {
    return this.datasource
      .metricFindQuery(this.queryBuilder.buildColumnQuery())
      .then(tags => {
        var options = [];
        if (!this.target.limit) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'LIMIT' }));
        }
        if (!this.queryModel.hasGroupByTime()) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'time', value: 'time(1m,none)' }));
        }
        for (let tag of tags) {
          options.push(this.uiSegmentSrv.newSegment({ type: 'column', value: 'column(' + tag.text + ')' }));
        }
        return options;
      })
      .catch(this.handleQueryError.bind(this));
  }

  groupByAction() {
    switch (this.groupBySegment.value) {
      case 'LIMIT': {
        this.target.limit = 10;
        break;
      }
      case 'ORDER BY time DESC': {
        this.target.orderByTime = 'DESC';
        break;
      }
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
