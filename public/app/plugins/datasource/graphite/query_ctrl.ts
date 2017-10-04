import './add_graphite_func';
import './func_editor';

import _ from 'lodash';
import gfunc from './gfunc';
import {Parser} from './parser';
import {QueryCtrl} from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

export class GraphiteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  functions: any[];
  segments: any[];
  tagSegments: any[];
  seriesByTagUsed: boolean;
  removeTagSegment: any;

  /** @ngInject **/
  constructor($scope, $injector, private uiSegmentSrv, private templateSrv) {
    super($scope, $injector);

    if (this.target) {
      this.target.target = this.target.target || '';
      this.parseTarget();
    }

    this.removeTagSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove tag --'});
  }

  toggleEditorMode() {
    this.target.textEditor = !this.target.textEditor;
    this.parseTarget();
  }

  parseTarget() {
    this.functions = [];
    this.segments = [];
    this.error = null;

    if (this.target.textEditor) {
      return;
    }

    var parser = new Parser(this.target.target);
    var astNode = parser.getAst();
    if (astNode === null) {
      this.checkOtherSegments(0);
      return;
    }

    if (astNode.type === 'error') {
      this.error = astNode.message + " at position: " + astNode.pos;
      this.target.textEditor = true;
      return;
    }

    try {
      this.parseTargetRecursive(astNode, null, 0);
    } catch (err) {
      console.log('error parsing target:', err.message);
      this.error = err.message;
      this.target.textEditor = true;
    }

    this.checkOtherSegments(this.segments.length - 1);
    this.checkForSeriesByTag();
  }

  addFunctionParameter(func, value, index, shiftBack) {
    if (shiftBack) {
      index = Math.max(index - 1, 0);
    }
    func.params[index] = value;
  }

  parseTargetRecursive(astNode, func, index) {
    if (astNode === null) {
      return null;
    }

    switch (astNode.type) {
      case 'function':
        var innerFunc = gfunc.createFuncInstance(astNode.name, { withDefaultParams: false });
        _.each(astNode.params, (param, index) => {
          this.parseTargetRecursive(param, innerFunc, index);
        });

        innerFunc.updateText();
        this.functions.push(innerFunc);
        break;
      case 'series-ref':
        this.addFunctionParameter(func, astNode.value, index, this.segments.length > 0);
        break;
      case 'bool':
      case 'string':
      case 'number':
        if ((index-1) >= func.def.params.length) {
          throw { message: 'invalid number of parameters to method ' + func.def.name };
        }
        var shiftBack = this.isShiftParamsBack(func);
        this.addFunctionParameter(func, astNode.value, index, shiftBack);
      break;
      case 'metric':
        if (this.segments.length > 0) {
        if (astNode.segments.length !== 1) {
          throw { message: 'Multiple metric params not supported, use text editor.' };
        }
        this.addFunctionParameter(func, astNode.segments[0].value, index, true);
        break;
      }

      this.segments = _.map(astNode.segments, segment => {
        return this.uiSegmentSrv.newSegment(segment);
      });
    }
  }

  isShiftParamsBack(func) {
    return func.def.name !== 'seriesByTag';
  }

  checkForSeriesByTag() {
    let seriesByTagFunc = _.find(this.functions, (func) => func.def.name === 'seriesByTag');
    if (seriesByTagFunc) {
      this.seriesByTagUsed = true;
      let tags = this.splitSeriesByTagParams(seriesByTagFunc);
      this.tagSegments = [];
      _.each(tags, (tag) => {
        this.tagSegments.push(this.uiSegmentSrv.newKey(tag.key));
        this.tagSegments.push(this.uiSegmentSrv.newOperator(tag.operator));
        this.tagSegments.push(this.uiSegmentSrv.newKeyValue(tag.value));
      });

      this.fixTagSegments();
    }
  }

  splitSeriesByTagParams(func) {
    const tagPattern = /([^\!=~]+)([\!=~]+)([^\!=~]+)/;
    return _.flatten(_.map(func.params, (param: string) => {
      let matches = tagPattern.exec(param);
      if (matches) {
        let tag = matches.slice(1);
        if (tag.length === 3) {
          return {
            key: tag[0],
            operator: tag[1],
            value: tag[2]
          }
        }
      }
      return [];
    }));
  }

  getSegmentPathUpTo(index) {
    var arr = this.segments.slice(0, index);

    return _.reduce(arr, function(result, segment) {
      return result ? (result + "." + segment.value) : segment.value;
    }, "");
  }

  checkOtherSegments(fromIndex) {
    if (fromIndex === 0) {
      this.segments.push(this.uiSegmentSrv.newSelectMetric());
      return;
    }

    var path = this.getSegmentPathUpTo(fromIndex + 1);
    if (path === "") {
      return Promise.resolve();
    }

    return this.datasource.metricFindQuery(path).then(segments => {
      if (segments.length === 0) {
        if (path !== '') {
          this.segments = this.segments.splice(0, fromIndex);
          this.segments.push(this.uiSegmentSrv.newSelectMetric());
        }
      } else if (segments[0].expandable) {
        if (this.segments.length === fromIndex) {
          this.segments.push(this.uiSegmentSrv.newSelectMetric());
        } else {
          return this.checkOtherSegments(fromIndex + 1);
        }
      }
    }).catch(err => {
      appEvents.emit('alert-error', ['Error', err]);
    });
  }

  setSegmentFocus(segmentIndex) {
    _.each(this.segments, (segment, index) => {
      segment.focus = segmentIndex === index;
    });
  }

  wrapFunction(target, func) {
    return func.render(target);
  }

  getAltTagSegments(index) {
    let paramPartIndex = getParamPartIndex(index);

    if (paramPartIndex === 1) {
      // Operator
      let operators = ['=', '!=', '=~', '!=~'];
      let segments = _.map(operators, (operator) => this.uiSegmentSrv.newOperator(operator));
      return Promise.resolve(segments);
    } else if (paramPartIndex === 0) {
      // Tag
      return this.datasource.getTags().then(segments => {
        let altSegments = _.map(segments, segment => {
          return this.uiSegmentSrv.newSegment({value: segment.text, expandable: false});
        });
        altSegments.splice(0, 0, _.cloneDeep(this.removeTagSegment));
        return altSegments;
      });
    } else {
      // Tag value
      let relatedTagSegmentIndex = getRelatedTagSegmentIndex(index);
      let tag = this.tagSegments[relatedTagSegmentIndex].value;
      return this.datasource.getTagValues(tag).then(segments => {
        let altSegments = _.map(segments, segment => {
          return this.uiSegmentSrv.newSegment({value: segment.text, expandable: false});
        });
        return altSegments;
      });
    }
  }

  getAltSegments(index) {
    var query = index === 0 ?  '*' : this.getSegmentPathUpTo(index) + '.*';
    var options = {range: this.panelCtrl.range, requestId: "get-alt-segments"};

    return this.datasource.metricFindQuery(query, options).then(segments => {
      var altSegments = _.map(segments, segment => {
        return this.uiSegmentSrv.newSegment({value: segment.text, expandable: segment.expandable});
      });

      if (altSegments.length === 0) { return altSegments; }

      // add template variables
      _.each(this.templateSrv.variables, variable => {
        altSegments.unshift(this.uiSegmentSrv.newSegment({
          type: 'template',
          value: '$' + variable.name,
          expandable: true,
        }));
      });

      // add wildcard option
      altSegments.unshift(this.uiSegmentSrv.newSegment('*'));
      return altSegments;
    }).catch(err => {
      return [];
    });
  }

  segmentValueChanged(segment, segmentIndex) {
    this.error = null;

    if (this.functions.length > 0 && this.functions[0].def.fake) {
      this.functions = [];
    }

    if (segment.expandable) {
      return this.checkOtherSegments(segmentIndex + 1).then(() => {
        this.setSegmentFocus(segmentIndex + 1);
        this.targetChanged();
      });
    } else {
      this.segments = this.segments.splice(0, segmentIndex + 1);
    }

    this.setSegmentFocus(segmentIndex + 1);
    this.targetChanged();
  }

  tagSegmentChanged(tagSegment, segmentIndex) {
    this.error = null;

    if (tagSegment.value === this.removeTagSegment.value) {
      this.removeTag(segmentIndex);
      return;
    }

    if (tagSegment.type === 'plus-button') {
      let newTag = {key: tagSegment.value, operator: '=', value: 'select tag value'};
      this.tagSegments.splice(this.tagSegments.length - 1, 1);
      this.addNewTag(newTag);
    }

    let paramIndex = getParamIndex(segmentIndex);
    let newTagParam = this.renderTagParam(segmentIndex);
    this.functions[this.getSeriesByTagFuncIndex()].params[paramIndex] = newTagParam;

    this.targetChanged();
    this.parseTarget();
  }

  getSeriesByTagFuncIndex() {
    return _.findIndex(this.functions, (func) => func.def.name === 'seriesByTag');
  }

  addNewTag(tag) {
    this.tagSegments.push(this.uiSegmentSrv.newKey(tag.key));
    this.tagSegments.push(this.uiSegmentSrv.newOperator(tag.operator));
    this.tagSegments.push(this.uiSegmentSrv.newKeyValue(tag.value));
  }

  removeTag(index) {
    let paramIndex = getParamIndex(index);
    this.tagSegments.splice(index, 3);
    this.functions[this.getSeriesByTagFuncIndex()].params.splice(paramIndex, 1);

    this.targetChanged();
    this.parseTarget();
  }

  renderTagParam(segmentIndex) {
    let tagIndex = getRelatedTagSegmentIndex(segmentIndex)
    return _.map(this.tagSegments.slice(tagIndex, tagIndex + 3), (segment) => segment.value).join('');
  }

  targetTextChanged() {
    this.updateModelTarget();
    this.refresh();
  }

  updateModelTarget() {
    // render query
    if (!this.target.textEditor) {
      var metricPath = this.getSegmentPathUpTo(this.segments.length);
      this.target.target = _.reduce(this.functions, this.wrapFunction, metricPath);
    }

    this.updateRenderedTarget(this.target);

    // loop through other queries and update targetFull as needed
    for (const target of this.panelCtrl.panel.targets || []) {
      if (target.refId !== this.target.refId) {
        this.updateRenderedTarget(target);
      }
    }
  }

  updateRenderedTarget(target) {
    // render nested query
    var targetsByRefId = _.keyBy(this.panelCtrl.panel.targets, 'refId');

    // no references to self
    delete targetsByRefId[target.refId];

    var nestedSeriesRefRegex = /\#([A-Z])/g;
    var targetWithNestedQueries = target.target;

    // Keep interpolating until there are no query references
    // The reason for the loop is that the referenced query might contain another reference to another query
    while (targetWithNestedQueries.match(nestedSeriesRefRegex)) {
      var updated = targetWithNestedQueries.replace(nestedSeriesRefRegex, (match, g1) => {
        var t = targetsByRefId[g1];
        if (!t) {
          return match;
        }

        // no circular references
        delete targetsByRefId[g1];
        return t.target;
      });

      if (updated === targetWithNestedQueries) {
        break;
      }

      targetWithNestedQueries = updated;
    }

    delete target.targetFull;
    if (target.target !== targetWithNestedQueries) {
      target.targetFull = targetWithNestedQueries;
    }
  }

  targetChanged() {
    if (this.error) {
      return;
    }

    var oldTarget = this.target.target;
    this.updateModelTarget();

    if (this.target.target !== oldTarget) {
      var lastSegment = this.segments.length > 0 ? this.segments[this.segments.length - 1] : {};
      if (lastSegment.value !== 'select metric') {
        this.panelCtrl.refresh();
      }
    }
  }

  removeFunction(func) {
    this.functions = _.without(this.functions, func);
    this.targetChanged();
  }

  addFunction(funcDef) {
    var newFunc = gfunc.createFuncInstance(funcDef, { withDefaultParams: true });
    newFunc.added = true;
    this.functions.push(newFunc);

    this.moveAliasFuncLast();
    this.smartlyHandleNewAliasByNode(newFunc);

    if (this.segments.length === 1 && this.segments[0].fake) {
      this.segments = [];
    }

    if (!newFunc.params.length && newFunc.added) {
      this.targetChanged();
    }

    if (newFunc.def.name === 'seriesByTag') {
      this.parseTarget();
    }
  }

  moveAliasFuncLast() {
    var aliasFunc = _.find(this.functions, function(func) {
      return func.def.name === 'alias' ||
        func.def.name === 'aliasByNode' ||
        func.def.name === 'aliasByMetric';
    });

    if (aliasFunc) {
      this.functions = _.without(this.functions, aliasFunc);
      this.functions.push(aliasFunc);
    }
  }

  smartlyHandleNewAliasByNode(func) {
    if (func.def.name !== 'aliasByNode') {
      return;
    }

    for (var i = 0; i < this.segments.length; i++) {
      if (this.segments[i].value.indexOf('*') >= 0)  {
        func.params[0] = i;
        func.added = false;
        this.targetChanged();
        return;
      }
    }
  }

  fixTagSegments() {
    var count = this.tagSegments.length;
    var lastSegment = this.tagSegments[Math.max(count-1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      this.tagSegments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  showDelimiter(index) {
    return getParamPartIndex(index) === 2 && index !== this.tagSegments.length - 2;
  }
}

function getParamIndex(segmentIndex) {
  return Math.floor(segmentIndex / 3);
}

function getParamPartIndex(segmentIndex) {
  return segmentIndex % 3;
}

function getRelatedTagSegmentIndex(segmentIndex) {
  return getParamIndex(segmentIndex) * 3;
}
