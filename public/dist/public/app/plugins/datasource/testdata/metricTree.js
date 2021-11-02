import { __values } from "tslib";
/*
 *  Builds a nested tree like
 *  [
 *    {
 *      name: 'A',
 *      children: [
 *        { name: 'AA', children: [] },
 *        { name: 'AB', children: [] },
 *      ]
 *    }
 *  ]
 */
function buildMetricTree(parent, depth) {
    var e_1, _a;
    var chars = ['A', 'B', 'C'];
    var children = [];
    if (depth > 5) {
        return [];
    }
    try {
        for (var chars_1 = __values(chars), chars_1_1 = chars_1.next(); !chars_1_1.done; chars_1_1 = chars_1.next()) {
            var letter = chars_1_1.value;
            var nodeName = "" + parent + letter;
            children.push({
                name: nodeName,
                children: buildMetricTree(nodeName, depth + 1),
            });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (chars_1_1 && !chars_1_1.done && (_a = chars_1.return)) _a.call(chars_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return children;
}
function queryTree(children, query, queryIndex) {
    var e_2, _a, e_3, _b;
    if (queryIndex >= query.length) {
        return children;
    }
    if (query[queryIndex] === '*') {
        return children;
    }
    var nodeQuery = query[queryIndex];
    var result = [];
    var namesToMatch = [nodeQuery];
    // handle glob queries
    if (nodeQuery.startsWith('{')) {
        namesToMatch = nodeQuery.replace(/\{|\}/g, '').split(',');
    }
    try {
        for (var children_1 = __values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
            var node = children_1_1.value;
            try {
                for (var namesToMatch_1 = (e_3 = void 0, __values(namesToMatch)), namesToMatch_1_1 = namesToMatch_1.next(); !namesToMatch_1_1.done; namesToMatch_1_1 = namesToMatch_1.next()) {
                    var nameToMatch = namesToMatch_1_1.value;
                    if (nameToMatch.indexOf('*') !== -1) {
                        var pattern = nameToMatch.replace('*', '');
                        var regex = new RegExp("^" + pattern + ".*", 'gi');
                        if (regex.test(node.name)) {
                            result = result.concat(queryTree([node], query, queryIndex + 1));
                        }
                    }
                    else if (node.name === nameToMatch) {
                        result = result.concat(queryTree(node.children, query, queryIndex + 1));
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (namesToMatch_1_1 && !namesToMatch_1_1.done && (_b = namesToMatch_1.return)) _b.call(namesToMatch_1);
                }
                finally { if (e_3) throw e_3.error; }
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
    return result;
}
export function queryMetricTree(query) {
    if (query.indexOf('value') === 0) {
        return [{ name: query, children: [] }];
    }
    var children = buildMetricTree('', 0);
    return queryTree(children, query.split('.'), 0);
}
//# sourceMappingURL=metricTree.js.map