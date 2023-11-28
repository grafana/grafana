import { compact, each, findIndex, flatten, get, join, keyBy, last, map, reduce, without } from 'lodash';
import { arrayMove } from 'app/core/utils/arrayMove';
import { Parser } from './parser';
export default class GraphiteQuery {
    constructor(datasource, target, templateSrv, scopedVars) {
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
    parseTarget() {
        this.functions = [];
        this.segments = [];
        this.tags = [];
        this.seriesByTagUsed = false;
        this.error = null;
        if (this.target.textEditor) {
            return;
        }
        const parser = new Parser(this.target.target);
        const astNode = parser.getAst();
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
            if (err instanceof Error) {
                console.error('error parsing target:', err.message);
                this.error = err.message;
            }
            this.target.textEditor = true;
        }
        this.checkOtherSegmentsIndex = this.segments.length - 1;
    }
    getSegmentPathUpTo(index) {
        const arr = this.segments.slice(0, index);
        return reduce(arr, (result, segment) => {
            return result ? result + '.' + segment.value : segment.value;
        }, '');
    }
    parseTargetRecursive(astNode, func) {
        if (astNode === null) {
            return null;
        }
        switch (astNode.type) {
            case 'function':
                const innerFunc = this.datasource.createFuncInstance(astNode.name, {
                    withDefaultParams: false,
                });
                // bug fix for parsing multiple functions as params
                handleMultipleSeriesByTagsParams(astNode);
                each(astNode.params, (param) => {
                    this.parseTargetRecursive(param, innerFunc);
                });
                innerFunc.updateText();
                this.functions.push(innerFunc);
                // extract tags from seriesByTag function and hide function
                if (innerFunc.def.name === 'seriesByTag' && !this.seriesByTagUsed) {
                    this.seriesByTagUsed = true;
                    innerFunc.hidden = true;
                    this.tags = this.splitSeriesByTagParams(innerFunc);
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
    }
    updateSegmentValue(segment, index) {
        this.segments[index].value = segment.value;
    }
    addSelectMetricSegment() {
        this.segments.push({ value: 'select metric' });
    }
    addFunction(newFunc) {
        this.functions.push(newFunc);
    }
    addFunctionParameter(func, value) {
        if (func.params.length >= func.def.params.length && !get(last(func.def.params), 'multiple', false)) {
            throw { message: 'too many parameters for function ' + func.def.name };
        }
        func.params.push(value);
    }
    removeFunction(func) {
        this.functions = without(this.functions, func);
    }
    moveFunction(func, offset) {
        const index = this.functions.indexOf(func);
        arrayMove(this.functions, index, index + offset);
    }
    updateModelTarget(targets) {
        const wrapFunction = (target, func) => {
            return func.render(target, (value) => {
                return this.templateSrv.replace(value, this.scopedVars);
            });
        };
        if (!this.target.textEditor) {
            const metricPath = this.getSegmentPathUpTo(this.segments.length).replace(/\.?select metric$/, '');
            this.target.target = reduce(this.functions, wrapFunction, metricPath);
        }
        this.updateRenderedTarget(this.target, targets);
        // loop through other queries and update targetFull as needed
        for (const target of targets || []) {
            if (target.refId !== this.target.refId) {
                this.updateRenderedTarget(target, targets);
            }
        }
        // clean-up added param
        this.functions.forEach((func) => (func.added = false));
    }
    updateRenderedTarget(target, targets) {
        // render nested query
        const targetsByRefId = keyBy(targets, 'refId');
        // no references to self
        delete targetsByRefId[target.refId];
        const nestedSeriesRefRegex = /\#([A-Z])/g;
        let targetWithNestedQueries = target.target;
        // Use ref count to track circular references
        each(targetsByRefId, (t, id) => {
            var _a;
            const regex = RegExp(`\#(${id})`, 'g');
            const refMatches = targetWithNestedQueries.match(regex);
            t.refCount = (_a = refMatches === null || refMatches === void 0 ? void 0 : refMatches.length) !== null && _a !== void 0 ? _a : 0;
        });
        // Keep interpolating until there are no query references
        // The reason for the loop is that the referenced query might contain another reference to another query
        while (targetWithNestedQueries.match(nestedSeriesRefRegex)) {
            const updated = targetWithNestedQueries.replace(nestedSeriesRefRegex, (match, g1) => {
                const t = targetsByRefId[g1];
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
        return flatten(map(func.params, (param) => {
            const matches = tagPattern.exec(param);
            if (matches) {
                const tag = matches.slice(1);
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
    }
    getSeriesByTagFuncIndex() {
        return findIndex(this.functions, (func) => func.def.name === 'seriesByTag');
    }
    getSeriesByTagFunc() {
        const seriesByTagFuncIndex = this.getSeriesByTagFuncIndex();
        if (seriesByTagFuncIndex >= 0) {
            return this.functions[seriesByTagFuncIndex];
        }
        else {
            return undefined;
        }
    }
    addTag(tag) {
        const newTagParam = renderTagString(tag);
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
            if (this.tags.length === 0) {
                this.removeFunction(this.getSeriesByTagFunc());
                this.checkOtherSegmentsIndex = 0;
                this.seriesByTagUsed = false;
            }
            return;
        }
        this.getSeriesByTagFunc().params[tagIndex] = renderTagString(tag);
        this.tags[tagIndex] = tag;
    }
    renderTagExpressions(excludeIndex = -1) {
        return compact(map(this.tags, (tagExpr, index) => {
            // Don't render tag that we want to lookup
            if (index !== excludeIndex) {
                return tagExpr.key + tagExpr.operator + tagExpr.value;
            }
            else {
                return undefined;
            }
        }));
    }
}
function renderTagString(tag) {
    return tag.key + tag.operator + tag.value;
}
/**
 * mutates the second seriesByTag function into a string to fix a parsing bug
 * @param astNode
 * @param innerFunc
 */
function handleMultipleSeriesByTagsParams(astNode) {
    // if function has two params that are function seriesByTags keep the second as a string otherwise we have a parsing error
    if (astNode.params && astNode.params.length >= 2) {
        let count = 0;
        astNode.params = astNode.params.map((p) => {
            if (p.type === 'function') {
                count += 1;
            }
            if (count === 2 && p.type === 'function' && p.name === 'seriesByTag') {
                // convert second function to a string
                const stringParams = p.params &&
                    p.params.reduce((acc, p, idx, paramsArr) => {
                        if (idx === 0 || idx !== paramsArr.length - 1) {
                            return `${acc}'${p.value}',`;
                        }
                        return `${acc}'${p.value}'`;
                    }, '');
                return {
                    type: 'string',
                    value: `${p.name}(${stringParams})`,
                };
            }
            return p;
        });
    }
}
//# sourceMappingURL=graphite_query.js.map