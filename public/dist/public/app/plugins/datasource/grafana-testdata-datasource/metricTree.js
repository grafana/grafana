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
    const chars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const children = [];
    if (depth > 5) {
        return [];
    }
    for (const letter of chars) {
        const nodeName = `${parent}${letter}`;
        children.push({
            name: nodeName,
            children: buildMetricTree(nodeName, depth + 1),
        });
    }
    return children;
}
function queryTree(children, query, queryIndex) {
    if (queryIndex >= query.length) {
        return children;
    }
    if (query[queryIndex] === '*') {
        return children;
    }
    const nodeQuery = query[queryIndex];
    let result = [];
    let namesToMatch = [nodeQuery];
    // handle glob queries
    if (nodeQuery.startsWith('{')) {
        namesToMatch = nodeQuery.replace(/\{|\}/g, '').split(',');
    }
    for (const node of children) {
        for (const nameToMatch of namesToMatch) {
            if (nameToMatch.indexOf('*') !== -1) {
                const pattern = nameToMatch.replace('*', '');
                const regex = new RegExp(`^${pattern}.*`, 'gi');
                if (regex.test(node.name)) {
                    result = result.concat(queryTree([node], query, queryIndex + 1));
                }
            }
            else if (node.name === nameToMatch) {
                result = result.concat(queryTree(node.children, query, queryIndex + 1));
            }
        }
    }
    return result;
}
export function queryMetricTree(query) {
    if (query.indexOf('value') === 0) {
        return [{ name: query, children: [] }];
    }
    const children = buildMetricTree('', 0);
    return queryTree(children, query.split('.'), 0);
}
//# sourceMappingURL=metricTree.js.map