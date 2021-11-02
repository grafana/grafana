import { __values } from "tslib";
import { compact, each, findIndex, flatten, get, join, keyBy, last, map, reduce, without } from 'lodash';
import { arrayMove } from 'app/core/utils/arrayMove';
import { Parser } from './parser';
var GraphiteQuery = /** @class */ (function () {
    /** @ngInject */
    function GraphiteQuery(datasource, target, templateSrv, scopedVars) {
        this.functions = [];
        this.segments = [];
        this.tags = [];
        this.seriesByTagUsed = false;
        this.checkOtherSegmentsIndex = 0;
        this.datasource = datasource;
        this.target = target;
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
        this.parseTarget();
        this.removeTagValue = '-- remove tag --';
    }
    GraphiteQuery.prototype.parseTarget = function () {
        this.functions = [];
        this.segments = [];
        this.tags = [];
        this.seriesByTagUsed = false;
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
        }
        catch (err) {
            console.error('error parsing target:', err.message);
            this.error = err.message;
            this.target.textEditor = true;
        }
        this.checkOtherSegmentsIndex = this.segments.length - 1;
    };
    GraphiteQuery.prototype.getSegmentPathUpTo = function (index) {
        var arr = this.segments.slice(0, index);
        return reduce(arr, function (result, segment) {
            return result ? result + '.' + segment.value : segment.value;
        }, '');
    };
    GraphiteQuery.prototype.parseTargetRecursive = function (astNode, func) {
        var _this = this;
        if (astNode === null) {
            return null;
        }
        switch (astNode.type) {
            case 'function':
                var innerFunc_1 = this.datasource.createFuncInstance(astNode.name, {
                    withDefaultParams: false,
                });
                each(astNode.params, function (param) {
                    _this.parseTargetRecursive(param, innerFunc_1);
                });
                innerFunc_1.updateText();
                this.functions.push(innerFunc_1);
                // extract tags from seriesByTag function and hide function
                if (innerFunc_1.def.name === 'seriesByTag' && !this.seriesByTagUsed) {
                    this.seriesByTagUsed = true;
                    innerFunc_1.hidden = true;
                    this.tags = this.splitSeriesByTagParams(innerFunc_1);
                }
                break;
            case 'series-ref':
                if (this.segments.length > 0 || this.getSeriesByTagFuncIndex() >= 0) {
                    this.addFunctionParameter(func, astNode.value);
                }
                else {
                    this.segments.push(astNode);
                }
                break;
            case 'bool':
            case 'string':
            case 'number':
                this.addFunctionParameter(func, astNode.value);
                break;
            case 'metric':
                if (this.segments.length || this.tags.length) {
                    this.addFunctionParameter(func, join(map(astNode.segments, 'value'), '.'));
                }
                else {
                    this.segments = astNode.segments;
                }
                break;
        }
    };
    GraphiteQuery.prototype.updateSegmentValue = function (segment, index) {
        this.segments[index].value = segment.value;
    };
    GraphiteQuery.prototype.addSelectMetricSegment = function () {
        this.segments.push({ value: 'select metric' });
    };
    GraphiteQuery.prototype.addFunction = function (newFunc) {
        this.functions.push(newFunc);
    };
    GraphiteQuery.prototype.addFunctionParameter = function (func, value) {
        if (func.params.length >= func.def.params.length && !get(last(func.def.params), 'multiple', false)) {
            throw { message: 'too many parameters for function ' + func.def.name };
        }
        func.params.push(value);
    };
    GraphiteQuery.prototype.removeFunction = function (func) {
        this.functions = without(this.functions, func);
    };
    GraphiteQuery.prototype.moveFunction = function (func, offset) {
        var index = this.functions.indexOf(func);
        arrayMove(this.functions, index, index + offset);
    };
    GraphiteQuery.prototype.updateModelTarget = function (targets) {
        var e_1, _a;
        var _this = this;
        var wrapFunction = function (target, func) {
            return func.render(target, function (value) {
                return _this.templateSrv.replace(value, _this.scopedVars);
            });
        };
        if (!this.target.textEditor) {
            var metricPath = this.getSegmentPathUpTo(this.segments.length).replace(/\.?select metric$/, '');
            this.target.target = reduce(this.functions, wrapFunction, metricPath);
        }
        this.updateRenderedTarget(this.target, targets);
        try {
            // loop through other queries and update targetFull as needed
            for (var _b = __values(targets || []), _c = _b.next(); !_c.done; _c = _b.next()) {
                var target = _c.value;
                if (target.refId !== this.target.refId) {
                    this.updateRenderedTarget(target, targets);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // clean-up added param
        this.functions.forEach(function (func) { return (func.added = false); });
    };
    GraphiteQuery.prototype.updateRenderedTarget = function (target, targets) {
        // render nested query
        var targetsByRefId = keyBy(targets, 'refId');
        // no references to self
        delete targetsByRefId[target.refId];
        var nestedSeriesRefRegex = /\#([A-Z])/g;
        var targetWithNestedQueries = target.target;
        // Use ref count to track circular references
        function countTargetRefs(targetsByRefId, refId) {
            var refCount = 0;
            each(targetsByRefId, function (t, id) {
                if (id !== refId) {
                    var match = nestedSeriesRefRegex.exec(t.target);
                    var count = match && match.length ? match.length - 1 : 0;
                    refCount += count;
                }
            });
            targetsByRefId[refId].refCount = refCount;
        }
        each(targetsByRefId, function (t, id) {
            countTargetRefs(targetsByRefId, id);
        });
        // Keep interpolating until there are no query references
        // The reason for the loop is that the referenced query might contain another reference to another query
        while (targetWithNestedQueries.match(nestedSeriesRefRegex)) {
            var updated = targetWithNestedQueries.replace(nestedSeriesRefRegex, function (match, g1) {
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
    };
    GraphiteQuery.prototype.splitSeriesByTagParams = function (func) {
        var tagPattern = /([^\!=~]+)(\!?=~?)(.*)/;
        return flatten(map(func.params, function (param) {
            var matches = tagPattern.exec(param);
            if (matches) {
                var tag = matches.slice(1);
                if (tag.length === 3) {
                    return {
                        key: tag[0],
                        operator: tag[1],
                        value: tag[2],
                    };
                }
            }
            return [];
        }));
    };
    GraphiteQuery.prototype.getSeriesByTagFuncIndex = function () {
        return findIndex(this.functions, function (func) { return func.def.name === 'seriesByTag'; });
    };
    GraphiteQuery.prototype.getSeriesByTagFunc = function () {
        var seriesByTagFuncIndex = this.getSeriesByTagFuncIndex();
        if (seriesByTagFuncIndex >= 0) {
            return this.functions[seriesByTagFuncIndex];
        }
        else {
            return undefined;
        }
    };
    GraphiteQuery.prototype.addTag = function (tag) {
        var newTagParam = renderTagString(tag);
        this.getSeriesByTagFunc().params.push(newTagParam);
        this.tags.push(tag);
    };
    GraphiteQuery.prototype.removeTag = function (index) {
        this.getSeriesByTagFunc().params.splice(index, 1);
        this.tags.splice(index, 1);
    };
    GraphiteQuery.prototype.updateTag = function (tag, tagIndex) {
        this.error = null;
        if (tag.key === this.removeTagValue) {
            this.removeTag(tagIndex);
            if (this.tags.length === 0) {
                this.removeFunction(this.getSeriesByTagFunc());
                this.checkOtherSegmentsIndex = 0;
                this.seriesByTagUsed = false;
            }
            return;
        }
        this.getSeriesByTagFunc().params[tagIndex] = renderTagString(tag);
        this.tags[tagIndex] = tag;
    };
    GraphiteQuery.prototype.renderTagExpressions = function (excludeIndex) {
        if (excludeIndex === void 0) { excludeIndex = -1; }
        return compact(map(this.tags, function (tagExpr, index) {
            // Don't render tag that we want to lookup
            if (index !== excludeIndex) {
                return tagExpr.key + tagExpr.operator + tagExpr.value;
            }
            else {
                return undefined;
            }
        }));
    };
    return GraphiteQuery;
}());
export default GraphiteQuery;
function renderTagString(tag) {
    return tag.key + tag.operator + tag.value;
}
//# sourceMappingURL=graphite_query.js.map