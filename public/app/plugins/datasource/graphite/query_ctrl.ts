import './add_graphite_func';
import './func_editor';

import _ from 'lodash';
import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';
import { auto } from 'angular';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { AppEvents } from '@grafana/data';

const GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];
const TAG_PREFIX = 'tag: ';

export class GraphiteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  queryModel: GraphiteQuery;
  segments: any[];
  addTagSegments: any[];
  removeTagValue: string;
  supportsTags: boolean;
  paused: boolean;

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private uiSegmentSrv: any,
    private templateSrv: TemplateSrv,
    $timeout: any
  ) {
    super($scope, $injector);
    this.supportsTags = this.datasource.supportsTags;
    this.paused = false;
    this.target.target = this.target.target || '';

    this.datasource.waitForFuncDefsLoaded().then(() => {
      this.queryModel = new GraphiteQuery(this.datasource, this.target, templateSrv);
      this.buildSegments(false);
    });

    this.removeTagValue = '-- remove tag --';
  }

  parseTarget() {
    this.queryModel.parseTarget();
    this.buildSegments();
  }

  toggleEditorMode() {
    this.target.textEditor = !this.target.textEditor;
    this.parseTarget();
  }

  buildSegments(modifyLastSegment = true) {
    this.segments = _.map(this.queryModel.segments, segment => {
      return this.uiSegmentSrv.newSegment(segment);
    });

    const checkOtherSegmentsIndex = this.queryModel.checkOtherSegmentsIndex || 0;

    promiseToDigest(this.$scope)(this.checkOtherSegments(checkOtherSegmentsIndex, modifyLastSegment));

    if (this.queryModel.seriesByTagUsed) {
      this.fixTagSegments();
    }
  }

  addSelectMetricSegment() {
    this.queryModel.addSelectMetricSegment();
    this.segments.push(this.uiSegmentSrv.newSelectMetric());
  }

  checkOtherSegments(fromIndex: number, modifyLastSegment = true) {
    if (this.queryModel.segments.length === 1 && this.queryModel.segments[0].type === 'series-ref') {
      return Promise.resolve();
    }

    if (fromIndex === 0) {
      this.addSelectMetricSegment();
      return Promise.resolve();
    }

    const path = this.queryModel.getSegmentPathUpTo(fromIndex + 1);
    if (path === '') {
      return Promise.resolve();
    }

    return this.datasource
      .metricFindQuery(path)
      .then((segments: any) => {
        if (segments.length === 0) {
          if (path !== '' && modifyLastSegment) {
            this.queryModel.segments = this.queryModel.segments.splice(0, fromIndex);
            this.segments = this.segments.splice(0, fromIndex);
            this.addSelectMetricSegment();
          }
        } else if (segments[0].expandable) {
          if (this.segments.length === fromIndex) {
            this.addSelectMetricSegment();
          } else {
            return this.checkOtherSegments(fromIndex + 1);
          }
        }
      })
      .catch((err: any) => {
        appEvents.emit(AppEvents.alertError, ['Error', err]);
      });
  }

  setSegmentFocus(segmentIndex: any) {
    _.each(this.segments, (segment, index) => {
      segment.focus = segmentIndex === index;
    });
  }

  getAltSegments(index: number, prefix: string) {
    let query = prefix && prefix.length > 0 ? '*' + prefix + '*' : '*';
    if (index > 0) {
      query = this.queryModel.getSegmentPathUpTo(index) + '.' + query;
    }
    const options = {
      range: this.panelCtrl.range,
      requestId: 'get-alt-segments',
    };

    return this.datasource
      .metricFindQuery(query, options)
      .then((segments: any[]) => {
        const altSegments = _.map(segments, segment => {
          return this.uiSegmentSrv.newSegment({
            value: segment.text,
            expandable: segment.expandable,
          });
        });

        if (index > 0 && altSegments.length === 0) {
          return altSegments;
        }

        // add query references
        if (index === 0) {
          _.eachRight(this.panelCtrl.panel.targets, target => {
            if (target.refId === this.queryModel.target.refId) {
              return;
            }

            altSegments.unshift(
              this.uiSegmentSrv.newSegment({
                type: 'series-ref',
                value: '#' + target.refId,
                expandable: false,
              })
            );
          });
        }

        // add template variables
        _.eachRight(this.templateSrv.variables, variable => {
          altSegments.unshift(
            this.uiSegmentSrv.newSegment({
              type: 'template',
              value: '$' + variable.name,
              expandable: true,
            })
          );
        });

        // add wildcard option
        altSegments.unshift(this.uiSegmentSrv.newSegment('*'));

        if (this.supportsTags && index === 0) {
          this.removeTaggedEntry(altSegments);
          return this.addAltTagSegments(prefix, altSegments);
        } else {
          return altSegments;
        }
      })
      .catch((err: any): any[] => {
        return [];
      });
  }

  addAltTagSegments(prefix: string, altSegments: any[]) {
    return this.getTagsAsSegments(prefix).then((tagSegments: any[]) => {
      tagSegments = _.map(tagSegments, segment => {
        segment.value = TAG_PREFIX + segment.value;
        return segment;
      });
      return altSegments.concat(...tagSegments);
    });
  }

  removeTaggedEntry(altSegments: any[]) {
    altSegments = _.remove(altSegments, s => s.value === '_tagged');
  }

  segmentValueChanged(segment: { type: string; value: string; expandable: any }, segmentIndex: number) {
    this.error = null;
    this.queryModel.updateSegmentValue(segment, segmentIndex);

    if (this.queryModel.functions.length > 0 && this.queryModel.functions[0].def.fake) {
      this.queryModel.functions = [];
    }

    if (segment.type === 'tag') {
      const tag = removeTagPrefix(segment.value);
      this.pause();
      this.addSeriesByTagFunc(tag);
      return null;
    }

    if (segment.expandable) {
      return promiseToDigest(this.$scope)(
        this.checkOtherSegments(segmentIndex + 1).then(() => {
          this.setSegmentFocus(segmentIndex + 1);
          this.targetChanged();
        })
      );
    } else {
      this.spliceSegments(segmentIndex + 1);
    }

    this.setSegmentFocus(segmentIndex + 1);
    this.targetChanged();

    return null;
  }

  spliceSegments(index: any) {
    this.segments = this.segments.splice(0, index);
    this.queryModel.segments = this.queryModel.segments.splice(0, index);
  }

  emptySegments() {
    this.queryModel.segments = [];
    this.segments = [];
  }

  targetTextChanged() {
    this.updateModelTarget();
    this.refresh();
  }

  updateModelTarget() {
    this.queryModel.updateModelTarget(this.panelCtrl.panel.targets);
  }

  targetChanged() {
    if (this.queryModel.error) {
      return;
    }

    const oldTarget = this.queryModel.target.target;
    this.updateModelTarget();

    if (this.queryModel.target !== oldTarget && !this.paused) {
      this.panelCtrl.refresh();
    }
  }

  addFunction(funcDef: any) {
    const newFunc = this.datasource.createFuncInstance(funcDef, {
      withDefaultParams: true,
    });
    newFunc.added = true;
    this.queryModel.addFunction(newFunc);
    this.smartlyHandleNewAliasByNode(newFunc);

    if (this.segments.length === 1 && this.segments[0].fake) {
      this.emptySegments();
    }

    if (!newFunc.params.length && newFunc.added) {
      this.targetChanged();
    }

    if (newFunc.def.name === 'seriesByTag') {
      this.parseTarget();
    }
  }

  removeFunction(func: any) {
    this.queryModel.removeFunction(func);
    this.targetChanged();
  }

  moveFunction(func: any, offset: any) {
    this.queryModel.moveFunction(func, offset);
    this.targetChanged();
  }

  addSeriesByTagFunc(tag: string) {
    const newFunc = this.datasource.createFuncInstance('seriesByTag', {
      withDefaultParams: false,
    });
    const tagParam = `${tag}=`;
    newFunc.params = [tagParam];
    this.queryModel.addFunction(newFunc);
    newFunc.added = true;

    this.emptySegments();
    this.targetChanged();
    this.parseTarget();
  }

  smartlyHandleNewAliasByNode(func: { def: { name: string }; params: number[]; added: boolean }) {
    if (func.def.name !== 'aliasByNode') {
      return;
    }

    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].value.indexOf('*') >= 0) {
        func.params[0] = i;
        func.added = false;
        this.targetChanged();
        return;
      }
    }
  }

  getAllTags() {
    return this.datasource.getTags().then((values: any[]) => {
      const altTags = _.map(values, 'text');
      altTags.splice(0, 0, this.removeTagValue);
      return mapToDropdownOptions(altTags);
    });
  }

  getTags(index: number, tagPrefix: any) {
    const tagExpressions = this.queryModel.renderTagExpressions(index);
    return this.datasource.getTagsAutoComplete(tagExpressions, tagPrefix).then((values: any) => {
      const altTags = _.map(values, 'text');
      altTags.splice(0, 0, this.removeTagValue);
      return mapToDropdownOptions(altTags);
    });
  }

  getTagsAsSegments(tagPrefix: string) {
    const tagExpressions = this.queryModel.renderTagExpressions();
    return this.datasource.getTagsAutoComplete(tagExpressions, tagPrefix).then((values: any) => {
      return _.map(values, val => {
        return this.uiSegmentSrv.newSegment({
          value: val.text,
          type: 'tag',
          expandable: false,
        });
      });
    });
  }

  getTagOperators() {
    return mapToDropdownOptions(GRAPHITE_TAG_OPERATORS);
  }

  getAllTagValues(tag: { key: any }) {
    const tagKey = tag.key;
    return this.datasource.getTagValues(tagKey).then((values: any[]) => {
      const altValues = _.map(values, 'text');
      return mapToDropdownOptions(altValues);
    });
  }

  getTagValues(tag: { key: any }, index: number, valuePrefix: any) {
    const tagExpressions = this.queryModel.renderTagExpressions(index);
    const tagKey = tag.key;
    return this.datasource.getTagValuesAutoComplete(tagExpressions, tagKey, valuePrefix).then((values: any[]) => {
      const altValues = _.map(values, 'text');
      // Add template variables as additional values
      _.eachRight(this.templateSrv.variables, variable => {
        altValues.push('${' + variable.name + ':regex}');
      });
      return mapToDropdownOptions(altValues);
    });
  }

  tagChanged(tag: any, tagIndex: any) {
    this.queryModel.updateTag(tag, tagIndex);
    this.targetChanged();
  }

  addNewTag(segment: { value: any }) {
    const newTagKey = segment.value;
    const newTag = { key: newTagKey, operator: '=', value: '' };
    this.queryModel.addTag(newTag);
    this.targetChanged();
    this.fixTagSegments();
  }

  removeTag(index: any) {
    this.queryModel.removeTag(index);
    this.targetChanged();
  }

  fixTagSegments() {
    // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
    this.addTagSegments = [this.uiSegmentSrv.newPlusButton()];
  }

  showDelimiter(index: number) {
    return index !== this.queryModel.tags.length - 1;
  }

  pause() {
    this.paused = true;
  }

  unpause() {
    this.paused = false;
    this.panelCtrl.refresh();
  }

  getCollapsedText() {
    return this.target.target;
  }
}

function mapToDropdownOptions(results: any[]) {
  return _.map(results, value => {
    return { text: value, value: value };
  });
}

function removeTagPrefix(value: string): string {
  return value.replace(TAG_PREFIX, '');
}
