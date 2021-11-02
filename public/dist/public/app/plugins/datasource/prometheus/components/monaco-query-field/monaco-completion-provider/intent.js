import { __read, __values } from "tslib";
import { parser } from 'lezer-promql';
import { NeverCaseError } from './util';
function move(node, direction) {
    switch (direction) {
        case 'parent':
            return node.parent;
        case 'firstChild':
            return node.firstChild;
        case 'lastChild':
            return node.lastChild;
        case 'nextSibling':
            return node.nextSibling;
        default:
            throw new NeverCaseError(direction);
    }
}
function walk(node, path) {
    var e_1, _a;
    var current = node;
    try {
        for (var path_1 = __values(path), path_1_1 = path_1.next(); !path_1_1.done; path_1_1 = path_1.next()) {
            var _b = __read(path_1_1.value, 2), direction = _b[0], expectedType = _b[1];
            current = move(current, direction);
            if (current === null) {
                // we could not move in the direction, we stop
                return null;
            }
            if (current.type.name !== expectedType) {
                // the reached node has wrong type, we stop
                return null;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (path_1_1 && !path_1_1.done && (_a = path_1.return)) _a.call(path_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return current;
}
function getNodeText(node, text) {
    return text.slice(node.from, node.to);
}
function parsePromQLStringLiteral(text) {
    // FIXME: support https://prometheus.io/docs/prometheus/latest/querying/basics/#string-literals
    // FIXME: maybe check other promql code, if all is supported or not
    // we start with double-quotes
    if (text.startsWith('"') && text.endsWith('"')) {
        if (text.indexOf('\\') !== -1) {
            throw new Error('FIXME: escape-sequences not supported in label-values');
        }
        return text.slice(1, text.length - 1);
    }
    else {
        throw new Error('FIXME: invalid string literal');
    }
}
function isPathMatch(resolverPath, cursorPath) {
    return resolverPath.every(function (item, index) { return item === cursorPath[index]; });
}
var ERROR_NODE_NAME = '⚠'; // this is used as error-name
var RESOLVERS = [
    {
        path: ['LabelMatchers', 'VectorSelector'],
        fun: resolveLabelKeysWithEquals,
    },
    {
        path: ['PromQL'],
        fun: resolveTopLevel,
    },
    {
        path: ['FunctionCallBody'],
        fun: resolveInFunction,
    },
    {
        path: [ERROR_NODE_NAME, 'LabelMatcher'],
        fun: resolveLabelMatcherError,
    },
    {
        path: [ERROR_NODE_NAME, 'MatrixSelector'],
        fun: resolveDurations,
    },
    {
        path: ['GroupingLabels'],
        fun: resolveLabelsForGrouping,
    },
];
var LABEL_OP_MAP = new Map([
    ['EqlSingle', '='],
    ['EqlRegex', '=~'],
    ['Neq', '!='],
    ['NeqRegex', '!~'],
]);
function getLabelOp(opNode) {
    var _a;
    var opChild = opNode.firstChild;
    if (opChild === null) {
        return null;
    }
    return (_a = LABEL_OP_MAP.get(opChild.name)) !== null && _a !== void 0 ? _a : null;
}
function getLabel(labelMatcherNode, text) {
    if (labelMatcherNode.type.name !== 'LabelMatcher') {
        return null;
    }
    var nameNode = walk(labelMatcherNode, [['firstChild', 'LabelName']]);
    if (nameNode === null) {
        return null;
    }
    var opNode = walk(nameNode, [['nextSibling', 'MatchOp']]);
    if (opNode === null) {
        return null;
    }
    var op = getLabelOp(opNode);
    if (op === null) {
        return null;
    }
    var valueNode = walk(labelMatcherNode, [['lastChild', 'StringLiteral']]);
    if (valueNode === null) {
        return null;
    }
    var name = getNodeText(nameNode, text);
    var value = parsePromQLStringLiteral(getNodeText(valueNode, text));
    return { name: name, value: value, op: op };
}
function getLabels(labelMatchersNode, text) {
    if (labelMatchersNode.type.name !== 'LabelMatchers') {
        return [];
    }
    var listNode = walk(labelMatchersNode, [['firstChild', 'LabelMatchList']]);
    var labels = [];
    while (listNode !== null) {
        var matcherNode = walk(listNode, [['lastChild', 'LabelMatcher']]);
        if (matcherNode === null) {
            // unexpected, we stop
            return [];
        }
        var label = getLabel(matcherNode, text);
        if (label !== null) {
            labels.push(label);
        }
        // there might be more labels
        listNode = walk(listNode, [['firstChild', 'LabelMatchList']]);
    }
    // our labels-list is last-first, so we reverse it
    labels.reverse();
    return labels;
}
function getNodeChildren(node) {
    var child = node.firstChild;
    var children = [];
    while (child !== null) {
        children.push(child);
        child = child.nextSibling;
    }
    return children;
}
function getNodeInSubtree(node, typeName) {
    var e_2, _a;
    // first we try the current node
    if (node.type.name === typeName) {
        return node;
    }
    // then we try the children
    var children = getNodeChildren(node);
    try {
        for (var children_1 = __values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
            var child = children_1_1.value;
            var n = getNodeInSubtree(child, typeName);
            if (n !== null) {
                return n;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (children_1_1 && !children_1_1.done && (_a = children_1.return)) _a.call(children_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return null;
}
function resolveLabelsForGrouping(node, text, pos) {
    var aggrExpNode = walk(node, [
        ['parent', 'AggregateModifier'],
        ['parent', 'AggregateExpr'],
    ]);
    if (aggrExpNode === null) {
        return null;
    }
    var bodyNode = aggrExpNode.getChild('FunctionCallBody');
    if (bodyNode === null) {
        return null;
    }
    var metricIdNode = getNodeInSubtree(bodyNode, 'MetricIdentifier');
    if (metricIdNode === null) {
        return null;
    }
    var idNode = walk(metricIdNode, [['firstChild', 'Identifier']]);
    if (idNode === null) {
        return null;
    }
    var metricName = getNodeText(idNode, text);
    return {
        type: 'LABEL_NAMES_FOR_BY',
        metricName: metricName,
        otherLabels: [],
    };
}
function resolveLabelMatcherError(node, text, pos) {
    // we are probably in the scenario where the user is before entering the
    // label-value, like `{job=^}` (^ marks the cursor)
    var parent = walk(node, [['parent', 'LabelMatcher']]);
    if (parent === null) {
        return null;
    }
    var labelNameNode = walk(parent, [['firstChild', 'LabelName']]);
    if (labelNameNode === null) {
        return null;
    }
    var labelName = getNodeText(labelNameNode, text);
    // now we need to go up, to the parent of LabelMatcher,
    // there can be one or many `LabelMatchList` parents, we have
    // to go through all of them
    var firstListNode = walk(parent, [['parent', 'LabelMatchList']]);
    if (firstListNode === null) {
        return null;
    }
    var listNode = firstListNode;
    // we keep going through the parent-nodes
    // as long as they are LabelMatchList.
    // as soon as we reawch LabelMatchers, we stop
    var labelMatchersNode = null;
    while (labelMatchersNode === null) {
        var p = listNode.parent;
        if (p === null) {
            return null;
        }
        var name_1 = p.type.name;
        switch (name_1) {
            case 'LabelMatchList':
                //we keep looping
                listNode = p;
                continue;
            case 'LabelMatchers':
                // we reached the end, we can stop the loop
                labelMatchersNode = p;
                continue;
            default:
                // we reached some other node, we stop
                return null;
        }
    }
    // now we need to find the other names
    var otherLabels = getLabels(labelMatchersNode, text);
    var metricNameNode = walk(labelMatchersNode, [
        ['parent', 'VectorSelector'],
        ['firstChild', 'MetricIdentifier'],
        ['firstChild', 'Identifier'],
    ]);
    if (metricNameNode === null) {
        // we are probably in a situation without a metric name
        return {
            type: 'LABEL_VALUES',
            labelName: labelName,
            otherLabels: otherLabels,
        };
    }
    var metricName = getNodeText(metricNameNode, text);
    return {
        type: 'LABEL_VALUES',
        metricName: metricName,
        labelName: labelName,
        otherLabels: otherLabels,
    };
}
function resolveTopLevel(node, text, pos) {
    return {
        type: 'FUNCTIONS_AND_ALL_METRIC_NAMES',
    };
}
function resolveInFunction(node, text, pos) {
    return {
        type: 'ALL_METRIC_NAMES',
    };
}
function resolveDurations(node, text, pos) {
    return {
        type: 'ALL_DURATIONS',
    };
}
function subTreeHasError(node) {
    return getNodeInSubtree(node, ERROR_NODE_NAME) !== null;
}
function resolveLabelKeysWithEquals(node, text, pos) {
    // for example `something{^}`
    // there are some false positives that can end up in this situation, that we want
    // to eliminate, for example: `something{a~^}`
    // basically, if this subtree contains any error-node, we stop
    if (subTreeHasError(node)) {
        return null;
    }
    var metricNameNode = walk(node, [
        ['parent', 'VectorSelector'],
        ['firstChild', 'MetricIdentifier'],
        ['firstChild', 'Identifier'],
    ]);
    var otherLabels = getLabels(node, text);
    if (metricNameNode === null) {
        // we are probably in a situation without a metric name.
        return {
            type: 'LABEL_NAMES_FOR_SELECTOR',
            otherLabels: otherLabels,
        };
    }
    var metricName = getNodeText(metricNameNode, text);
    return {
        type: 'LABEL_NAMES_FOR_SELECTOR',
        metricName: metricName,
        otherLabels: otherLabels,
    };
}
// we find the first error-node in the tree that is at the cursor-position.
// NOTE: this might be too slow, might need to optimize it
// (ideas: we do not need to go into every subtree, based on from/to)
// also, only go to places that are in the sub-tree of the node found
// by default by lezer. problem is, `next()` will go upward too,
// and we do not want to go higher than our node
function getErrorNode(tree, pos) {
    var cur = tree.cursor(pos);
    while (true) {
        if (cur.from === pos && cur.to === pos) {
            var node = cur.node;
            if (node.type.isError) {
                return node;
            }
        }
        if (!cur.next()) {
            break;
        }
    }
    return null;
}
export function getIntent(text, pos) {
    // there is a special-case when we are at the start of writing text,
    // so we handle that case first
    var e_3, _a;
    if (text === '') {
        return {
            type: 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES',
        };
    }
    /*
      PromQL
  Expr
  VectorSelector
  LabelMatchers
  */
    var tree = parser.parse(text);
    // if the tree contains error, it is very probable that
    // our node is one of those error-nodes.
    // also, if there are errors, the node lezer finds us,
    // might not be the best node.
    // so first we check if there is an error-node at the cursor-position
    var maybeErrorNode = getErrorNode(tree, pos);
    var cur = maybeErrorNode != null ? maybeErrorNode.cursor : tree.cursor(pos);
    var currentNode = cur.node;
    var names = [cur.name];
    while (cur.parent()) {
        names.push(cur.name);
    }
    try {
        for (var RESOLVERS_1 = __values(RESOLVERS), RESOLVERS_1_1 = RESOLVERS_1.next(); !RESOLVERS_1_1.done; RESOLVERS_1_1 = RESOLVERS_1.next()) {
            var resolver = RESOLVERS_1_1.value;
            // i do not use a foreach because i want to stop as soon
            // as i find something
            if (isPathMatch(resolver.path, names)) {
                return resolver.fun(currentNode, text, pos);
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (RESOLVERS_1_1 && !RESOLVERS_1_1.done && (_a = RESOLVERS_1.return)) _a.call(RESOLVERS_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return null;
}
//# sourceMappingURL=intent.js.map