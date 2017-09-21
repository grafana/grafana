///<reference path="../../../headers/common.d.ts" />

import './add_graphite_func';
import './func_editor';

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import gfunc from './gfunc';
import {Parser} from './parser';
import {QueryCtrl} from 'app/plugins/sdk';
import appEvents from 'app/core/app_events';

export class GraphiteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  functions: any[];
  segments: any[];

  /** @ngInject **/
  constructor($scope, $injector, private uiSegmentSrv, private templateSrv) {
    super($scope, $injector);

    if (this.target) {
      this.target.target = this.target.target || '';
      this.parseTarget();
    }
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
        this.addFunctionParameter(func, astNode.value, index, true);
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
}
