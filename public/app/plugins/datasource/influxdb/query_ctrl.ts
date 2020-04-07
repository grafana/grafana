import angular, { auto } from 'angular';
import _ from 'lodash';
import { InfluxQueryBuilder } from './query_builder';
import InfluxQueryModel from './influx_query_model';
import queryPart from './query_part';
import { QueryCtrl } from 'app/plugins/sdk';
import { TemplateSrv } from 'app/features/templating/template_srv';

export class InfluxQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  queryModel: InfluxQueryModel;
  queryBuilder: any;
  groupBySegment: any;
  resultFormats: any[];
  orderByTime: any[];
  policySegment: any;
  tagSegments: any[];
  selectMenu: any;
  measurementSegment: any;
  removeTagFilterSegment: any;

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private templateSrv: TemplateSrv,
    private uiSegmentSrv: any
  ) {
    super($scope, $injector);
    this.target = this.target;
    this.queryModel = new InfluxQueryModel(this.target, templateSrv, this.panel.scopedVars);
    this.queryBuilder = new InfluxQueryBuilder(this.target, this.datasource.database);
    this.groupBySegment = this.uiSegmentSrv.newPlusButton();
    this.resultFormats = [
      { text: 'Time series', value: 'time_series' },
      { text: 'Table', value: 'table' },
    ];
    this.policySegment = uiSegmentSrv.newSegment(this.target.policy);

    if (!this.target.measurement) {
      this.measurementSegment = uiSegmentSrv.newSelectMeasurement();
    } else {
      this.measurementSegment = uiSegmentSrv.newSegment(this.target.measurement);
    }

    this.tagSegments = [];
    for (const tag of this.target.tags) {
      if (!tag.operator) {
        if (/^\/.*\/$/.test(tag.value)) {
          tag.operator = '=~';
        } else {
          tag.operator = '=';
        }
      }

      if (tag.condition) {
        this.tagSegments.push(uiSegmentSrv.newCondition(tag.condition));
      }

      this.tagSegments.push(uiSegmentSrv.newKey(tag.key));
      this.tagSegments.push(uiSegmentSrv.newOperator(tag.operator));
      this.tagSegments.push(uiSegmentSrv.newKeyValue(tag.value));
    }

    this.fixTagSegments();
    this.buildSelectMenu();
    this.removeTagFilterSegment = uiSegmentSrv.newSegment({
      fake: true,
      value: '-- remove tag filter --',
    });
  }

  removeOrderByTime() {
    this.target.orderByTime = 'ASC';
  }

  buildSelectMenu() {
    const categories = queryPart.getCategories();
    this.selectMenu = _.reduce(
      categories,
      (memo, cat, key) => {
        const menu = {
          text: key,
          submenu: cat.map((item: any) => {
            return { text: item.type, value: item.type };
          }),
        };
        memo.push(menu);
        return memo;
      },
      []
    );
  }

  getGroupByOptions() {
    const query = this.queryBuilder.buildExploreQuery('TAG_KEYS');

    return this.datasource
      .metricFindQuery(query)
      .then((tags: any) => {
        const options = [];
        if (!this.queryModel.hasFill()) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'fill(null)' }));
        }
        if (!this.target.limit) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'LIMIT' }));
        }
        if (!this.target.slimit) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'SLIMIT' }));
        }
        if (!this.target.tz) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'tz' }));
        }
        if (this.target.orderByTime === 'ASC') {
          options.push(this.uiSegmentSrv.newSegment({ value: 'ORDER BY time DESC' }));
        }
        if (!this.queryModel.hasGroupByTime()) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'time($interval)' }));
        }
        for (const tag of tags) {
          options.push(this.uiSegmentSrv.newSegment({ value: 'tag(' + tag.text + ')' }));
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
      case 'SLIMIT': {
        this.target.slimit = 10;
        break;
      }
      case 'tz': {
        this.target.tz = 'UTC';
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

    const plusButton = this.uiSegmentSrv.newPlusButton();
    this.groupBySegment.value = plusButton.value;
    this.groupBySegment.html = plusButton.html;
    this.panelCtrl.refresh();
  }

  addSelectPart(selectParts: any, cat: any, subitem: { value: any }) {
    this.queryModel.addSelectPart(selectParts, subitem.value);
    this.panelCtrl.refresh();
  }

  handleSelectPartEvent(selectParts: any, part: any, evt: { name: any }) {
    switch (evt.name) {
      case 'get-param-options': {
        const fieldsQuery = this.queryBuilder.buildExploreQuery('FIELDS');
        return this.datasource
          .metricFindQuery(fieldsQuery)
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
        return Promise.resolve([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  handleGroupByPartEvent(part: any, index: any, evt: { name: any }) {
    switch (evt.name) {
      case 'get-param-options': {
        const tagsQuery = this.queryBuilder.buildExploreQuery('TAG_KEYS');
        return this.datasource
          .metricFindQuery(tagsQuery)
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
        return Promise.resolve([{ text: 'Remove', value: 'remove-part' }]);
      }
    }
  }

  fixTagSegments() {
    const count = this.tagSegments.length;
    const lastSegment = this.tagSegments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  measurementChanged() {
    this.target.measurement = this.measurementSegment.value;
    this.panelCtrl.refresh();
  }

  getPolicySegments() {
    const policiesQuery = this.queryBuilder.buildExploreQuery('RETENTION POLICIES');
    return this.datasource
      .metricFindQuery(policiesQuery)
      .then(this.transformToSegments(false))
      .catch(this.handleQueryError.bind(this));
  }

  policyChanged() {
    this.target.policy = this.policySegment.value;
    this.panelCtrl.refresh();
  }

  toggleEditorMode() {
    try {
      this.target.query = this.queryModel.render(false);
    } catch (err) {
      console.log('query render error');
    }
    this.target.rawQuery = !this.target.rawQuery;
  }

  getMeasurements(measurementFilter: any) {
    const query = this.queryBuilder.buildExploreQuery('MEASUREMENTS', undefined, measurementFilter);
    return this.datasource
      .metricFindQuery(query)
      .then(this.transformToSegments(true))
      .catch(this.handleQueryError.bind(this));
  }

  handleQueryError(err: any): any[] {
    this.error = err.message || 'Failed to issue metric query';
    return [];
  }

  transformToSegments(addTemplateVars: any) {
    return (results: any) => {
      const segments = _.map(results, segment => {
        return this.uiSegmentSrv.newSegment({
          value: segment.text,
          expandable: segment.expandable,
        });
      });

      if (addTemplateVars) {
        for (const variable of this.templateSrv.getVariables()) {
          segments.unshift(
            this.uiSegmentSrv.newSegment({
              type: 'value',
              value: '/^$' + variable.name + '$/',
              expandable: true,
            })
          );
        }
      }

      return segments;
    };
  }

  getTagsOrValues(segment: { type: string }, index: number) {
    if (segment.type === 'condition') {
      return Promise.resolve([this.uiSegmentSrv.newSegment('AND'), this.uiSegmentSrv.newSegment('OR')]);
    }
    if (segment.type === 'operator') {
      const nextValue = this.tagSegments[index + 1].value;
      if (/^\/.*\/$/.test(nextValue)) {
        return Promise.resolve(this.uiSegmentSrv.newOperators(['=~', '!~']));
      } else {
        return Promise.resolve(this.uiSegmentSrv.newOperators(['=', '!=', '<>', '<', '>']));
      }
    }

    let query, addTemplateVars;
    if (segment.type === 'key' || segment.type === 'plus-button') {
      query = this.queryBuilder.buildExploreQuery('TAG_KEYS');
      addTemplateVars = false;
    } else if (segment.type === 'value') {
      query = this.queryBuilder.buildExploreQuery('TAG_VALUES', this.tagSegments[index - 2].value);
      addTemplateVars = true;
    }

    return this.datasource
      .metricFindQuery(query)
      .then(this.transformToSegments(addTemplateVars))
      .then((results: any) => {
        if (segment.type === 'key') {
          results.splice(0, 0, angular.copy(this.removeTagFilterSegment));
        }
        return results;
      })
      .catch(this.handleQueryError.bind(this));
  }

  getFieldSegments() {
    const fieldsQuery = this.queryBuilder.buildExploreQuery('FIELDS');
    return this.datasource
      .metricFindQuery(fieldsQuery)
      .then(this.transformToSegments(false))
      .catch(this.handleQueryError);
  }

  tagSegmentUpdated(segment: { value: any; type: string; cssClass: string }, index: number) {
    this.tagSegments[index] = segment;

    // handle remove tag condition
    if (segment.value === this.removeTagFilterSegment.value) {
      this.tagSegments.splice(index, 3);
      if (this.tagSegments.length === 0) {
        this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
      } else if (this.tagSegments.length > 2) {
        this.tagSegments.splice(Math.max(index - 1, 0), 1);
        if (this.tagSegments[this.tagSegments.length - 1].type !== 'plus-button') {
          this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
        }
      }
    } else {
      if (segment.type === 'plus-button') {
        if (index > 2) {
          this.tagSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
        }
        this.tagSegments.push(this.uiSegmentSrv.newOperator('='));
        this.tagSegments.push(this.uiSegmentSrv.newFake('select tag value', 'value', 'query-segment-value'));
        segment.type = 'key';
        segment.cssClass = 'query-segment-key';
      }

      if (index + 1 === this.tagSegments.length) {
        this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
      }
    }

    this.rebuildTargetTagConditions();
  }

  rebuildTargetTagConditions() {
    const tags: any[] = [];
    let tagIndex = 0;
    let tagOperator = '';

    _.each(this.tagSegments, (segment2, index) => {
      if (segment2.type === 'key') {
        if (tags.length === 0) {
          tags.push({});
        }
        tags[tagIndex].key = segment2.value;
      } else if (segment2.type === 'value') {
        tagOperator = this.getTagValueOperator(segment2.value, tags[tagIndex].operator);
        if (tagOperator) {
          this.tagSegments[index - 1] = this.uiSegmentSrv.newOperator(tagOperator);
          tags[tagIndex].operator = tagOperator;
        }
        tags[tagIndex].value = segment2.value;
      } else if (segment2.type === 'condition') {
        tags.push({ condition: segment2.value });
        tagIndex += 1;
      } else if (segment2.type === 'operator') {
        tags[tagIndex].operator = segment2.value;
      }
    });

    this.target.tags = tags;
    this.panelCtrl.refresh();
  }

  getTagValueOperator(tagValue: string, tagOperator: string): string {
    if (tagOperator !== '=~' && tagOperator !== '!~' && /^\/.*\/$/.test(tagValue)) {
      return '=~';
    } else if ((tagOperator === '=~' || tagOperator === '!~') && /^(?!\/.*\/$)/.test(tagValue)) {
      return '=';
    }
    return null;
  }

  getCollapsedText() {
    return this.queryModel.render(false);
  }
}
