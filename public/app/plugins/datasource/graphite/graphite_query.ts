import _ from 'lodash';
import { Parser } from './parser';

export default class GraphiteQuery {
  datasource: any;
  target: any;
  functions: any[];
  segments: any[];
  tags: any[];
  error: any;
  seriesByTagUsed: boolean;
  checkOtherSegmentsIndex: number;
  removeTagValue: string;
  templateSrv: any;
  scopedVars: any;

  /** @ngInject */
  constructor(datasource, target, templateSrv?, scopedVars?) {
    this.datasource = datasource;
    this.target = target;
    this.parseTarget();

    this.removeTagValue = '-- remove tag --';
  }

  parseTarget() {
    this.functions = [];
    this.segments = [];
    this.tags = [];
    this.error = null;

    if (this.target.textEditor) {
      return;
    }

    var parser = new Parser(this.target.target);
    var astNode = parser.getAst();
    if (astNode === null) {
      this.checkOtherSegmentsIndex = 0;
      return;
    }

    if (astNode.type === 'error') {
      this.error = astNode.message + ' at position: ' + astNode.pos;
      this.target.textEditor = true;
      return;
    }

    try {
      this.parseTargetRecursive(astNode, null);
    } catch (err) {
      console.log('error parsing target:', err.message);
      this.error = err.message;
      this.target.textEditor = true;
    }

    this.checkOtherSegmentsIndex = this.segments.length - 1;
    this.checkForSeriesByTag();
  }

  checkForSeriesByTag() {
    let seriesByTagFunc = _.find(this.functions, func => func.def.name === 'seriesByTag');
    if (seriesByTagFunc) {
      this.seriesByTagUsed = true;
      seriesByTagFunc.hidden = true;
      let tags = this.splitSeriesByTagParams(seriesByTagFunc);
      this.tags = tags;
    }
  }

  getSegmentPathUpTo(index) {
    var arr = this.segments.slice(0, index);

    return _.reduce(
      arr,
      function(result, segment) {
        return result ? result + '.' + segment.value : segment.value;
      },
      ''
    );
  }

  parseTargetRecursive(astNode, func) {
    if (astNode === null) {
      return null;
    }

    switch (astNode.type) {
      case 'function':
        var innerFunc = this.datasource.createFuncInstance(astNode.name, {
          withDefaultParams: false,
        });
        _.each(astNode.params, param => {
          this.parseTargetRecursive(param, innerFunc);
        });

        innerFunc.updateText();
        this.functions.push(innerFunc);
        break;
      case 'series-ref':
        if (this.segments.length > 0) {
          this.addFunctionParameter(func, astNode.value);
        } else {
          this.segments.push(astNode);
        }
        break;
      case 'bool':
      case 'string':
      case 'number':
        this.addFunctionParameter(func, astNode.value);
        break;
      case 'metric':
        if (this.segments.length > 0) {
          this.addFunctionParameter(func, _.join(_.map(astNode.segments, 'value'), '.'));
        } else {
          this.segments = astNode.segments;
        }
        break;
    }
  }

  updateSegmentValue(segment, index) {
    this.segments[index].value = segment.value;
  }

  addSelectMetricSegment() {
    this.segments.push({ value: 'select metric' });
  }

  addFunction(newFunc) {
    this.functions.push(newFunc);
    this.moveAliasFuncLast();
  }

  moveAliasFuncLast() {
    var aliasFunc = _.find(this.functions, function(func) {
      return func.def.name.startsWith('alias');
    });

    if (aliasFunc) {
      this.functions = _.without(this.functions, aliasFunc);
      this.functions.push(aliasFunc);
    }
  }

  addFunctionParameter(func, value) {
    if (func.params.length >= func.def.params.length && !_.get(_.last(func.def.params), 'multiple', false)) {
      throw { message: 'too many parameters for function ' + func.def.name };
    }
    func.params.push(value);
  }

  removeFunction(func) {
    this.functions = _.without(this.functions, func);
  }

  updateModelTarget(targets) {
    // render query
    if (!this.target.textEditor) {
      var metricPath = this.getSegmentPathUpTo(this.segments.length).replace(/\.select metric$/, '');
      this.target.target = _.reduce(this.functions, wrapFunction, metricPath);
    }

    this.updateRenderedTarget(this.target, targets);

    // loop through other queries and update targetFull as needed
    for (const target of targets || []) {
      if (target.refId !== this.target.refId) {
        this.updateRenderedTarget(target, targets);
      }
    }
  }

  updateRenderedTarget(target, targets) {
    // render nested query
    var targetsByRefId = _.keyBy(targets, 'refId');

    // no references to self
    delete targetsByRefId[target.refId];

    var nestedSeriesRefRegex = /\#([A-Z])/g;
    var targetWithNestedQueries = target.target;

    // Use ref count to track circular references
    function countTargetRefs(targetsByRefId, refId) {
      let refCount = 0;
      _.each(targetsByRefId, (t, id) => {
        if (id !== refId) {
          let match = nestedSeriesRefRegex.exec(t.target);
          let count = match && match.length ? match.length - 1 : 0;
          refCount += count;
        }
      });
      targetsByRefId[refId].refCount = refCount;
    }
    _.each(targetsByRefId, (t, id) => {
      countTargetRefs(targetsByRefId, id);
    });

    // Keep interpolating until there are no query references
    // The reason for the loop is that the referenced query might contain another reference to another query
    while (targetWithNestedQueries.match(nestedSeriesRefRegex)) {
      var updated = targetWithNestedQueries.replace(nestedSeriesRefRegex, (match, g1) => {
        var t = targetsByRefId[g1];
        if (!t) {
          return match;
        }

        // no circular references
        if (t.refCount === 0) {
          delete targetsByRefId[g1];
        }
        t.refCount--;

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

  splitSeriesByTagParams(func) {
    const tagPattern = /([^\!=~]+)(\!?=~?)(.*)/;
    return _.flatten(
      _.map(func.params, (param: string) => {
        let matches = tagPattern.exec(param);
        if (matches) {
          let tag = matches.slice(1);
          if (tag.length === 3) {
            return {
              key: tag[0],
              operator: tag[1],
              value: tag[2],
            };
          }
        }
        return [];
      })
    );
  }

  getSeriesByTagFuncIndex() {
    return _.findIndex(this.functions, func => func.def.name === 'seriesByTag');
  }

  getSeriesByTagFunc() {
    let seriesByTagFuncIndex = this.getSeriesByTagFuncIndex();
    if (seriesByTagFuncIndex >= 0) {
      return this.functions[seriesByTagFuncIndex];
    } else {
      return undefined;
    }
  }

  addTag(tag) {
    let newTagParam = renderTagString(tag);
    this.getSeriesByTagFunc().params.push(newTagParam);
    this.tags.push(tag);
  }

  removeTag(index) {
    this.getSeriesByTagFunc().params.splice(index, 1);
    this.tags.splice(index, 1);
  }

  updateTag(tag, tagIndex) {
    this.error = null;

    if (tag.key === this.removeTagValue) {
      this.removeTag(tagIndex);
      return;
    }

    let newTagParam = renderTagString(tag);
    this.getSeriesByTagFunc().params[tagIndex] = newTagParam;
    this.tags[tagIndex] = tag;
  }

  renderTagExpressions(excludeIndex = -1) {
    return _.compact(
      _.map(this.tags, (tagExpr, index) => {
        // Don't render tag that we want to lookup
        if (index !== excludeIndex) {
          return tagExpr.key + tagExpr.operator + tagExpr.value;
        }
      })
    );
  }
}

function wrapFunction(target, func) {
  return func.render(target);
}

function renderTagString(tag) {
  return tag.key + tag.operator + tag.value;
}
