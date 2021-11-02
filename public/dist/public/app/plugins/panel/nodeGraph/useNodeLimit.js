import { __read, __spreadArray, __values } from "tslib";
import { fromPairs, uniq } from 'lodash';
import { useMemo } from 'react';
/**
 * Limits the number of nodes by going from the roots breadth first until we have desired number of nodes.
 */
export function useNodeLimit(nodes, edges, limit, config, rootId) {
    // This is pretty expensive also this happens once in the layout code when initializing position but it's a bit
    // tricky to do it only once and reuse the results because layout directly modifies the nodes.
    var _a = __read(useMemo(function () {
        // Make sure we don't compute this until we have all the data.
        if (!(nodes.length && edges.length)) {
            return [{}, {}];
        }
        var edgesMap = edges.reduce(function (acc, e) {
            var _a, _b;
            acc[e.source.id] = __spreadArray(__spreadArray([], __read(((_a = acc[e.source.id]) !== null && _a !== void 0 ? _a : [])), false), [e], false);
            acc[e.target.id] = __spreadArray(__spreadArray([], __read(((_b = acc[e.target.id]) !== null && _b !== void 0 ? _b : [])), false), [e], false);
            return acc;
        }, {});
        var nodesMap = nodes.reduce(function (acc, node) {
            acc[node.id] = node;
            return acc;
        }, {});
        return [edgesMap, nodesMap];
    }, [edges, nodes]), 2), edgesMap = _a[0], nodesMap = _a[1];
    return useMemo(function () {
        if (nodes.length <= limit) {
            return { nodes: nodes, edges: edges };
        }
        if (config.gridLayout) {
            return limitGridLayout(nodes, limit, rootId);
        }
        return limitGraphLayout(nodes, edges, nodesMap, edgesMap, limit, rootId);
    }, [edges, edgesMap, limit, nodes, nodesMap, rootId, config.gridLayout]);
}
export function limitGraphLayout(nodes, edges, nodesMap, edgesMap, limit, rootId) {
    var e_1, _a;
    var roots;
    if (rootId) {
        roots = [nodesMap[rootId]];
    }
    else {
        roots = nodes.filter(function (n) { return n.incoming === 0; });
        // TODO: same code as layout
        if (!roots.length) {
            roots = [nodes[0]];
        }
    }
    var _b = collectVisibleNodes(limit, roots, nodesMap, edgesMap), visibleNodes = _b.visibleNodes, markers = _b.markers;
    var markersWithStats = collectMarkerStats(markers, visibleNodes, nodesMap, edgesMap);
    var markersMap = fromPairs(markersWithStats.map(function (m) { return [m.node.id, m]; }));
    try {
        for (var markersWithStats_1 = __values(markersWithStats), markersWithStats_1_1 = markersWithStats_1.next(); !markersWithStats_1_1.done; markersWithStats_1_1 = markersWithStats_1.next()) {
            var marker = markersWithStats_1_1.value;
            if (marker.count === 1) {
                delete markersMap[marker.node.id];
                visibleNodes[marker.node.id] = marker.node;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (markersWithStats_1_1 && !markersWithStats_1_1.done && (_a = markersWithStats_1.return)) _a.call(markersWithStats_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // Show all edges between visible nodes or placeholder markers
    var visibleEdges = edges.filter(function (e) {
        return (visibleNodes[e.source.id] || markersMap[e.source.id]) && (visibleNodes[e.target.id] || markersMap[e.target.id]);
    });
    return {
        nodes: Object.values(visibleNodes),
        edges: visibleEdges,
        markers: Object.values(markersMap),
    };
}
export function limitGridLayout(nodes, limit, rootId) {
    var start = 0;
    var stop = limit;
    var markers = [];
    if (rootId) {
        var index = nodes.findIndex(function (node) { return node.id === rootId; });
        var prevLimit = Math.floor(limit / 2);
        var afterLimit = prevLimit;
        start = index - prevLimit;
        if (start < 0) {
            afterLimit += Math.abs(start);
            start = 0;
        }
        stop = index + afterLimit + 1;
        if (stop > nodes.length) {
            if (start > 0) {
                start = Math.max(0, start - (stop - nodes.length));
            }
            stop = nodes.length;
        }
        if (start > 1) {
            markers.push({ node: nodes[start - 1], count: start });
        }
        if (nodes.length - stop > 1) {
            markers.push({ node: nodes[stop], count: nodes.length - stop });
        }
    }
    else {
        if (nodes.length - limit > 1) {
            markers = [{ node: nodes[limit], count: nodes.length - limit }];
        }
    }
    return {
        nodes: nodes.slice(start, stop),
        edges: [],
        markers: markers,
    };
}
/**
 * Breath first traverse of the graph collecting all the nodes until we reach the limit. It also returns markers which
 * are nodes on the edges which did not make it into the limit but can be used as clickable markers for manually
 * expanding the graph.
 * @param limit
 * @param roots - Nodes where to start the traversal. In case of exploration this can be any node that user clicked on.
 * @param nodesMap - Node id to node
 * @param edgesMap - This is a map of node id to a list of edges (both ingoing and outgoing)
 */
function collectVisibleNodes(limit, roots, nodesMap, edgesMap) {
    var visibleNodes = {};
    var stack = __spreadArray([], __read(roots), false);
    var _loop_1 = function () {
        var current = stack.shift();
        // We are already showing this node. This can happen because graphs can be cyclic
        if (visibleNodes[current.id]) {
            return "continue";
        }
        // Show this node
        visibleNodes[current.id] = current;
        var edges = edgesMap[current.id] || [];
        // Add any nodes that are connected to it on top of the stack to be considered in the next pass
        var connectedNodes = edges.map(function (e) {
            // We don't care about direction here. Should not make much difference but argument could be made that with
            // directed graphs it should walk the graph directionally. Problem is when we focus on a node in the middle of
            // graph (not going from the "natural" root) we also want to show what was "before".
            var id = e.source.id === current.id ? e.target.id : e.source.id;
            return nodesMap[id];
        });
        stack = stack.concat(connectedNodes);
    };
    while (Object.keys(visibleNodes).length < limit && stack.length > 0) {
        _loop_1();
    }
    // Right now our stack contains all the nodes which are directly connected to the graph but did not make the cut.
    // Some of them though can be nodes we already are showing so we have to filter them and then use them as markers.
    var markers = uniq(stack.filter(function (n) { return !visibleNodes[n.id]; }));
    return { visibleNodes: visibleNodes, markers: markers };
}
function collectMarkerStats(markers, visibleNodes, nodesMap, edgesMap) {
    return markers.map(function (marker) {
        var nodesToCount = {};
        var count = 0;
        var stack = [marker];
        var _loop_2 = function () {
            var current = stack.shift();
            // We are showing this node so not going to count it as hidden.
            if (visibleNodes[current.id] || nodesToCount[current.id]) {
                return "continue";
            }
            if (!nodesToCount[current.id]) {
                count++;
            }
            nodesToCount[current.id] = current;
            var edges = edgesMap[current.id] || [];
            var connectedNodes = edges.map(function (e) {
                var id = e.source.id === current.id ? e.target.id : e.source.id;
                return nodesMap[id];
            });
            stack = stack.concat(connectedNodes);
        };
        while (stack.length > 0 && count <= 101) {
            _loop_2();
        }
        return {
            node: marker,
            count: count,
        };
    });
}
//# sourceMappingURL=useNodeLimit.js.map