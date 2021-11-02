import { __assign, __read, __spreadArray, __values } from "tslib";
import { useEffect, useMemo, useState } from 'react';
import { useNodeLimit } from './useNodeLimit';
import useMountedState from 'react-use/lib/useMountedState';
import { graphBounds } from './utils';
// @ts-ignore
import LayoutWorker from './layout.worker.js';
// Config mainly for the layout but also some other parts like current layout. The layout variables can be changed only
// if you programmatically enable the config editor (for development only) see ViewControls. These could be moved to
// panel configuration at some point (apart from gridLayout as that can be switched be user right now.).
export var defaultConfig = {
    linkDistance: 150,
    linkStrength: 0.5,
    forceX: 2000,
    forceXStrength: 0.02,
    forceCollide: 100,
    tick: 300,
    gridLayout: false,
};
/**
 * This will return copy of the nods and edges with x,y positions filled in. Also the layout changes source/target props
 * in edges from string ids to actual nodes.
 */
export function useLayout(rawNodes, rawEdges, config, nodeCountLimit, width, rootNodeId) {
    if (config === void 0) { config = defaultConfig; }
    var _a = __read(useState([]), 2), nodesGraph = _a[0], setNodesGraph = _a[1];
    var _b = __read(useState([]), 2), edgesGraph = _b[0], setEdgesGraph = _b[1];
    var _c = __read(useState(false), 2), loading = _c[0], setLoading = _c[1];
    var isMounted = useMountedState();
    // Also we compute both layouts here. Grid layout should not add much time and we can more easily just cache both
    // so this should happen only once for a given response data.
    //
    // Also important note is that right now this works on all the nodes even if they are not visible. This means that
    // the node position is stable even when expanding different parts of graph. It seems like a reasonable thing but
    // implications are that:
    // - limiting visible nodes count does not have a positive perf effect
    // - graphs with high node count can seem weird (very sparse or spread out) when we show only some nodes but layout
    //   is done for thousands of nodes but we also do this only once in the graph lifecycle.
    // We could re-layout this on visible nodes change but this may need smaller visible node limit to keep the perf
    // (as we would run layout on every click) and also would be very weird without any animation to understand what is
    // happening as already visible nodes would change positions.
    useEffect(function () {
        if (rawNodes.length === 0) {
            setNodesGraph([]);
            setEdgesGraph([]);
            return;
        }
        setLoading(true);
        // This is async but as I wanted to still run the sync grid layout and you cannot return promise from effect so
        // having callback seems ok here.
        defaultLayout(rawNodes, rawEdges, function (_a) {
            var nodes = _a.nodes, edges = _a.edges;
            // TODO: it would be better to cancel the worker somehow but probably not super important right now.
            if (isMounted()) {
                setNodesGraph(nodes);
                setEdgesGraph(edges);
                setLoading(false);
            }
        });
    }, [rawNodes, rawEdges, isMounted]);
    // Compute grid separately as it is sync and do not need to be inside effect. Also it is dependant on width while
    // default layout does not care and we don't want to recalculate that on panel resize.
    var _d = __read(useMemo(function () {
        if (rawNodes.length === 0) {
            return [[], []];
        }
        var rawNodesCopy = rawNodes.map(function (n) { return (__assign({}, n)); });
        var rawEdgesCopy = rawEdges.map(function (e) { return (__assign({}, e)); });
        gridLayout(rawNodesCopy, width, config.sort);
        return [rawNodesCopy, rawEdgesCopy];
    }, [config.sort, rawNodes, rawEdges, width]), 2), nodesGrid = _d[0], edgesGrid = _d[1];
    // Limit the nodes so we don't show all for performance reasons. Here we don't compute both at the same time so
    // changing the layout can trash internal memoization at the moment.
    var _e = useNodeLimit(config.gridLayout ? nodesGrid : nodesGraph, config.gridLayout ? edgesGrid : edgesGraph, nodeCountLimit, config, rootNodeId), nodesWithLimit = _e.nodes, edgesWithLimit = _e.edges, markers = _e.markers;
    // Get bounds based on current limited number of nodes.
    var bounds = useMemo(function () { return graphBounds(__spreadArray(__spreadArray([], __read(nodesWithLimit), false), __read((markers || []).map(function (m) { return m.node; })), false)); }, [
        nodesWithLimit,
        markers,
    ]);
    return {
        nodes: nodesWithLimit,
        edges: edgesWithLimit,
        markers: markers,
        bounds: bounds,
        hiddenNodesCount: rawNodes.length - nodesWithLimit.length,
        loading: loading,
    };
}
/**
 * Wraps the layout code in a worker as it can take long and we don't want to block the main thread.
 */
function defaultLayout(nodes, edges, done) {
    var worker = new LayoutWorker();
    worker.onmessage = function (event) {
        for (var i = 0; i < nodes.length; i++) {
            // These stats needs to be Field class but the data is stringified over the worker boundary
            event.data.nodes[i] = __assign(__assign({}, nodes[i]), event.data.nodes[i]);
        }
        done(event.data);
    };
    worker.postMessage({
        nodes: nodes.map(function (n) { return ({
            id: n.id,
            incoming: n.incoming,
        }); }),
        edges: edges,
        config: defaultConfig,
    });
}
/**
 * Set the nodes in simple grid layout sorted by some stat.
 */
function gridLayout(nodes, width, sort) {
    var e_1, _a;
    var spacingVertical = 140;
    var spacingHorizontal = 120;
    var padding = spacingHorizontal / 2;
    var perRow = Math.min(Math.floor((width - padding * 2) / spacingVertical), nodes.length);
    var midPoint = Math.floor(((perRow - 1) * spacingHorizontal) / 2);
    if (sort) {
        nodes.sort(function (node1, node2) {
            var val1 = sort.field.values.get(node1.dataFrameRowIndex);
            var val2 = sort.field.values.get(node2.dataFrameRowIndex);
            // Lets pretend we don't care about type of the stats for a while (they can be strings)
            return sort.ascending ? val1 - val2 : val2 - val1;
        });
    }
    try {
        for (var _b = __values(nodes.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), index = _d[0], node = _d[1];
            var row = Math.floor(index / perRow);
            var column = index % perRow;
            node.x = column * spacingHorizontal - midPoint;
            node.y = -60 + row * spacingVertical;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
//# sourceMappingURL=layout.js.map