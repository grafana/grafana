import { compact, memoize, uniq } from 'lodash';
import memoizeOne from 'memoize-one';
import { Graph } from 'app/core/utils/dag';
import { isExpressionQuery } from 'app/features/expressions/guards';
// memoized version of _createDagFromQueries to prevent recreating the DAG if no sources or targets are modified
export const createDagFromQueries = memoizeOne(_createDagFromQueries, (previous, next) => {
    return fingerPrintQueries(previous[0]) === fingerPrintQueries(next[0]);
});
/**
 * Turn the array of alert queries (this means data queries and expressions)
 * in to a DAG, a directed acyclical graph
 */
export function _createDagFromQueries(queries) {
    const graph = new Graph();
    const nodes = queries.map((query) => query.refId);
    graph.createNodes(nodes);
    queries.forEach((query) => {
        var _a;
        const source = query.refId;
        const isMathExpression = isExpressionQuery(query.model) && query.model.type === 'math';
        // some expressions have multiple targets (like the math expression)
        const targets = isMathExpression
            ? parseRefsFromMathExpression((_a = query.model.expression) !== null && _a !== void 0 ? _a : '')
            : [query.model.expression];
        targets.forEach((target) => {
            const isSelf = source === target;
            if (source && target && !isSelf) {
                graph.link(target, source);
            }
        });
    });
    return graph;
}
/**
 * parse an expression like "$A > $B" or "${FOO BAR} > 0" to an array of refIds
 */
export function parseRefsFromMathExpression(input) {
    // we'll use two regular expressions, one for "${var}" and one for "$var"
    const r1 = new RegExp(/\$\{(?<var>[a-zA-Z0-9_ ]+?)\}/gm);
    const r2 = new RegExp(/\$(?<var>[a-zA-Z0-9_]+)/gm);
    const m1 = Array.from(input.matchAll(r1)).map((m) => { var _a; return (_a = m.groups) === null || _a === void 0 ? void 0 : _a.var; });
    const m2 = Array.from(input.matchAll(r2)).map((m) => { var _a; return (_a = m.groups) === null || _a === void 0 ? void 0 : _a.var; });
    return compact(uniq([...m1, ...m2]));
}
export const getOriginOfRefId = memoize(_getOriginsOfRefId, (refId, graph) => refId + fingerprintGraph(graph));
export function _getOriginsOfRefId(refId, graph) {
    const node = graph.getNode(refId);
    let origins = [];
    // recurse through "node > inputEdges > inputNode"
    function findChildNode(node) {
        const inputEdges = node.inputEdges;
        if (inputEdges.length > 0) {
            inputEdges.forEach((edge) => {
                if (edge.inputNode) {
                    findChildNode(edge.inputNode);
                }
            });
        }
        else {
            origins === null || origins === void 0 ? void 0 : origins.push(node);
        }
    }
    findChildNode(node);
    return origins.map((origin) => origin.name);
}
// create a unique fingerprint of the DAG
export function fingerprintGraph(graph) {
    return Object.keys(graph.nodes)
        .map((name) => {
        const n = graph.nodes[name];
        let outputEdges = n.outputEdges.map((e) => { var _a; return (_a = e.outputNode) === null || _a === void 0 ? void 0 : _a.name; }).join(', ');
        let inputEdges = n.inputEdges.map((e) => { var _a; return (_a = e.inputNode) === null || _a === void 0 ? void 0 : _a.name; }).join(', ');
        return `${n.name}:${outputEdges}:${inputEdges}`;
    })
        .join(' ');
}
// create a unique fingerprint of the array of queries
export function fingerPrintQueries(queries) {
    return queries
        .map((query) => {
        var _a;
        const type = isExpressionQuery(query.model) ? query.model.type : query.queryType;
        return query.refId + ((_a = query.model.expression) !== null && _a !== void 0 ? _a : '') + type;
    })
        .join();
}
//# sourceMappingURL=dag.js.map