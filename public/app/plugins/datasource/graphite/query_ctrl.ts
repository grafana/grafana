import './add_graphite_func';
import './func_editor';

import _ from 'lodash';
import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

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
  constructor($scope, $injector, private uiSegmentSrv, private templateSrv, $timeout) {
    super($scope, $injector);
    this.supportsTags = this.datasource.supportsTags;
    this.paused = false;
    this.target.target = this.target.target || '';

    this.datasource.waitForFuncDefsLoaded().then(() => {
      this.queryModel = new GraphiteQuery(this.datasource, this.target, templateSrv);
      this.buildSegments();
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

  buildSegments() {
    this.segments = _.map(this.queryModel.segments, segment => {
      return this.uiSegmentSrv.newSegment(segment);
    });

    const checkOtherSegmentsIndex = this.queryModel.checkOtherSegmentsIndex || 0;
    this.checkOtherSegments(checkOtherSegmentsIndex);

    if (this.queryModel.seriesByTagUsed) {
      this.fixTagSegments();
    }
  }

  addSelectMetricSegment() {
    this.queryModel.addSelectMetricSegment();
    this.segments.push(this.uiSegmentSrv.newSelectMetric());
  }

  checkOtherSegments(fromIndex) {
    if (this.queryModel.segments.length === 1 && this.queryModel.segments[0].type === 'series-ref') {
      return;
    }

    if (fromIndex === 0) {
      this.addSelectMetricSegment();
      return;
    }

    const path = this.queryModel.getSegmentPathUpTo(fromIndex + 1);
    if (path === '') {
      return Promise.resolve();
    }

    return this.datasource
      .metricFindQuery(path)
      .then(segments => {
        if (segments.length === 0) {
          if (path !== '') {
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
      .catch(err => {
        appEvents.emit('alert-error', ['Error', err]);
      });
  }

  setSegmentFocus(segmentIndex) {
    _.each(this.segments, (segment, index) => {
      segment.focus = segmentIndex === index;
    });
  }

  getAltSegments(index, prefix) {
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
      .then(segments => {
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
      .catch(err => {
        return [];
      });
  }

  addAltTagSegments(prefix, altSegments) {
    return this.getTagsAsSegments(prefix).then(tagSegments => {
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

  segmentValueChanged(segment, segmentIndex) {
    this.error = null;
    this.queryModel.updateSegmentValue(segment, segmentIndex);

    if (this.queryModel.functions.length > 0 && this.queryModel.functions[0].def.fake) {
      this.queryModel.functions = [];
    }

    if (segment.type === 'tag') {
      const tag = removeTagPrefix(segment.value);
      this.pause();
      this.addSeriesByTagFunc(tag);
      return;
    }

    if (segment.expandable) {
      return this.checkOtherSegments(segmentIndex + 1).then(() => {
        this.setSegmentFocus(segmentIndex + 1);
        this.targetChanged();
      });
    } else {
      this.spliceSegments(segmentIndex + 1);
    }

    this.setSegmentFocus(segmentIndex + 1);
    this.targetChanged();
  }

  spliceSegments(index) {
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

  addFunction(funcDef) {
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

  removeFunction(func) {
    this.queryModel.removeFunction(func);
    this.targetChanged();
  }

  moveFunction(func, offset) {
    this.queryModel.moveFunction(func, offset);
    this.targetChanged();
  }

  addSeriesByTagFunc(tag) {
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

  smartlyHandleNewAliasByNode(func) {
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
    return this.datasource.getTags().then(values => {
      const altTags = _.map(values, 'text');
      altTags.splice(0, 0, this.removeTagValue);
      return mapToDropdownOptions(altTags);
    });
  }

  getTags(index, tagPrefix) {
    const tagExpressions = this.queryModel.renderTagExpressions(index);
    return this.datasource.getTagsAutoComplete(tagExpressions, tagPrefix).then(values => {
      const altTags = _.map(values, 'text');
      altTags.splice(0, 0, this.removeTagValue);
      return mapToDropdownOptions(altTags);
    });
  }

  getTagsAsSegments(tagPrefix) {
    const tagExpressions = this.queryModel.renderTagExpressions();
    return this.datasource.getTagsAutoComplete(tagExpressions, tagPrefix).then(values => {
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

  getAllTagValues(tag) {
    const tagKey = tag.key;
    return this.datasource.getTagValues(tagKey).then(values => {
      const altValues = _.map(values, 'text');
      return mapToDropdownOptions(altValues);
    });
  }

  getTagValues(tag, index, valuePrefix) {
    const tagExpressions = this.queryModel.renderTagExpressions(index);
    const tagKey = tag.key;
    return this.datasource.getTagValuesAutoComplete(tagExpressions, tagKey, valuePrefix).then(values => {
      const altValues = _.map(values, 'text');
      // Add template variables as additional values
      _.eachRight(this.templateSrv.variables, variable => {
        altValues.push('${' + variable.name + ':regex}');
      });
      return mapToDropdownOptions(altValues);
    });
  }

  tagChanged(tag, tagIndex) {
    this.queryModel.updateTag(tag, tagIndex);
    this.targetChanged();
  }

  addNewTag(segment) {
    const newTagKey = segment.value;
    const newTag = { key: newTagKey, operator: '=', value: '' };
    this.queryModel.addTag(newTag);
    this.targetChanged();
    this.fixTagSegments();
  }

  removeTag(index) {
    this.queryModel.removeTag(index);
    this.targetChanged();
  }

  fixTagSegments() {
    // Adding tag with the same name as just removed works incorrectly if single segment is used (instead of array)
    this.addTagSegments = [this.uiSegmentSrv.newPlusButton()];
  }

  showDelimiter(index) {
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

function mapToDropdownOptions(results) {
  return _.map(results, value => {
    return { text: value, value: value };
  });
}

function removeTagPrefix(value: string): string {
  return value.replace(TAG_PREFIX, '');
}
