import * as tslib_1 from "tslib";
import _ from 'lodash';
import { Parser } from './parser';
var GraphiteQuery = /** @class */ (function () {
    /** @ngInject */
    function GraphiteQuery(datasource, target, templateSrv, scopedVars) {
        this.datasource = datasource;
        this.target = target;
        this.parseTarget();
        this.removeTagValue = '-- remove tag --';
    }
    GraphiteQuery.prototype.parseTarget = function () {
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
        }
        catch (err) {
            console.log('error parsing target:', err.message);
            this.error = err.message;
            this.target.textEditor = true;
        }
        this.checkOtherSegmentsIndex = this.segments.length - 1;
        this.checkForSeriesByTag();
    };
    GraphiteQuery.prototype.checkForSeriesByTag = function () {
        var seriesByTagFunc = _.find(this.functions, function (func) { return func.def.name === 'seriesByTag'; });
        if (seriesByTagFunc) {
            this.seriesByTagUsed = true;
            seriesByTagFunc.hidden = true;
            var tags = this.splitSeriesByTagParams(seriesByTagFunc);
            this.tags = tags;
        }
    };
    GraphiteQuery.prototype.getSegmentPathUpTo = function (index) {
        var arr = this.segments.slice(0, index);
        return _.reduce(arr, function (result, segment) {
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
                _.each(astNode.params, function (param) {
                    _this.parseTargetRecursive(param, innerFunc_1);
                });
                innerFunc_1.updateText();
                this.functions.push(innerFunc_1);
                break;
            case 'series-ref':
                if (this.segments.length > 0) {
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
                if (this.segments.length > 0) {
                    this.addFunctionParameter(func, _.join(_.map(astNode.segments, 'value'), '.'));
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
        this.moveAliasFuncLast();
    };
    GraphiteQuery.prototype.moveAliasFuncLast = function () {
        var aliasFunc = _.find(this.functions, function (func) {
            return func.def.name.startsWith('alias');
        });
        if (aliasFunc) {
            this.functions = _.without(this.functions, aliasFunc);
            this.functions.push(aliasFunc);
        }
    };
    GraphiteQuery.prototype.addFunctionParameter = function (func, value) {
        if (func.params.length >= func.def.params.length && !_.get(_.last(func.def.params), 'multiple', false)) {
            throw { message: 'too many parameters for function ' + func.def.name };
        }
        func.params.push(value);
    };
    GraphiteQuery.prototype.removeFunction = function (func) {
        this.functions = _.without(this.functions, func);
    };
    GraphiteQuery.prototype.moveFunction = function (func, offset) {
        var index = this.functions.indexOf(func);
        _.move(this.functions, index, index + offset);
    };
    GraphiteQuery.prototype.updateModelTarget = function (targets) {
        var e_1, _a;
        // render query
        if (!this.target.textEditor) {
            var metricPath = this.getSegmentPathUpTo(this.segments.length).replace(/\.select metric$/, '');
            this.target.target = _.reduce(this.functions, wrapFunction, metricPath);
        }
        this.updateRenderedTarget(this.target, targets);
        try {
            // loop through other queries and update targetFull as needed
            for (var _b = tslib_1.__values(targets || []), _c = _b.next(); !_c.done; _c = _b.next()) {
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
    };
    GraphiteQuery.prototype.updateRenderedTarget = function (target, targets) {
        // render nested query
        var targetsByRefId = _.keyBy(targets, 'refId');
        // no references to self
        delete targetsByRefId[target.refId];
        var nestedSeriesRefRegex = /\#([A-Z])/g;
        var targetWithNestedQueries = target.target;
        // Use ref count to track circular references
        function countTargetRefs(targetsByRefId, refId) {
            var refCount = 0;
            _.each(targetsByRefId, function (t, id) {
                if (id !== refId) {
                    var match = nestedSeriesRefRegex.exec(t.target);
                    var count = match && match.length ? match.length - 1 : 0;
                    refCount += count;
                }
            });
            targetsByRefId[refId].refCount = refCount;
        }
        _.each(targetsByRefId, function (t, id) {
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
        return _.flatten(_.map(func.params, function (param) {
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
        return _.findIndex(this.functions, function (func) { return func.def.name === 'seriesByTag'; });
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
            return;
        }
        var newTagParam = renderTagString(tag);
        this.getSeriesByTagFunc().params[tagIndex] = newTagParam;
        this.tags[tagIndex] = tag;
    };
    GraphiteQuery.prototype.renderTagExpressions = function (excludeIndex) {
        if (excludeIndex === void 0) { excludeIndex = -1; }
        return _.compact(_.map(this.tags, function (tagExpr, index) {
            // Don't render tag that we want to lookup
            if (index !== excludeIndex) {
                return tagExpr.key + tagExpr.operator + tagExpr.value;
            }
        }));
    };
    return GraphiteQuery;
}());
export default GraphiteQuery;
function wrapFunction(target, func) {
    return func.render(target);
}
function renderTagString(tag) {
    return tag.key + tag.operator + tag.value;
}
//# sourceMappingURL=graphite_query.js.map