import { __assign, __read, __spreadArray, __values } from "tslib";
import { forceSimulation, forceLink, forceCollide, forceX } from 'd3-force';
addEventListener('message', function (event) {
    var _a = event.data, nodes = _a.nodes, edges = _a.edges, config = _a.config;
    layout(nodes, edges, config);
    postMessage({ nodes: nodes, edges: edges });
});
/**
 * Use d3 force layout to lay the nodes in a sensible way. This function modifies the nodes adding the x,y positions
 * and also fills in node references in edges instead of node ids.
 */
export function layout(nodes, edges, config) {
    // Start with some hardcoded positions so it starts laid out from left to right
    var _a = initializePositions(nodes, edges), roots = _a.roots, secondLevelRoots = _a.secondLevelRoots;
    // There always seems to be one or more root nodes each with single edge and we want to have them static on the
    // left neatly in something like grid layout
    __spreadArray(__spreadArray([], __read(roots), false), __read(secondLevelRoots), false).forEach(function (n, index) {
        n.fx = n.x;
    });
    var simulation = forceSimulation(nodes)
        .force('link', forceLink(edges)
        .id(function (d) { return d.id; })
        .distance(config.linkDistance)
        .strength(config.linkStrength))
        // to keep the left to right layout we add force that pulls all nodes to right but because roots are fixed it will
        // apply only to non root nodes
        .force('x', forceX(config.forceX).strength(config.forceXStrength))
        // Make sure nodes don't overlap
        .force('collide', forceCollide(config.forceCollide));
    // 300 ticks for the simulation are recommended but less would probably work too, most movement is done in first
    // few iterations and then all the forces gets smaller https://github.com/d3/d3-force#simulation_alphaDecay
    simulation.tick(config.tick);
    simulation.stop();
    // We do centering here instead of using centering force to keep this more stable
    centerNodes(nodes);
}
/**
 * This initializes positions of the graph by going from the root to it's children and laying it out in a grid from left
 * to right. This works only so, so because service map graphs can have cycles and children levels are not ordered in a
 * way to minimize the edge lengths. Nevertheless this seems to make the graph easier to nudge with the forces later on
 * than with the d3 default initial positioning. Also we can fix the root positions later on for a bit more neat
 * organisation.
 *
 * This function directly modifies the nodes given and only returns references to root nodes so they do not have to be
 * found again later on.
 *
 * How the spacing could look like approximately:
 * 0 - 0 - 0 - 0
 *  \- 0 - 0   |
 *      \- 0 -/
 * 0 - 0 -/
 */
function initializePositions(nodes, edges) {
    var e_1, _a, e_2, _b;
    // To prevent going in cycles
    var alreadyPositioned = {};
    var nodesMap = nodes.reduce(function (acc, node) {
        acc[node.id] = node;
        return acc;
    }, {});
    var edgesMap = edges.reduce(function (acc, edge) {
        var sourceId = edge.source;
        acc[sourceId] = __spreadArray(__spreadArray([], __read((acc[sourceId] || [])), false), [edge], false);
        return acc;
    }, {});
    var roots = nodes.filter(function (n) { return n.incoming === 0; });
    // For things like service maps we assume there is some root (client) node but if there is none then selecting
    // any node as a starting point should work the same.
    if (!roots.length) {
        roots = [nodes[0]];
    }
    var secondLevelRoots = roots.reduce(function (acc, r) {
        acc.push.apply(acc, __spreadArray([], __read((edgesMap[r.id] ? edgesMap[r.id].map(function (e) { return nodesMap[e.target]; }) : [])), false));
        return acc;
    }, []);
    var rootYSpacing = 300;
    var nodeYSpacing = 200;
    var nodeXSpacing = 200;
    var rootY = 0;
    try {
        for (var roots_1 = __values(roots), roots_1_1 = roots_1.next(); !roots_1_1.done; roots_1_1 = roots_1.next()) {
            var root = roots_1_1.value;
            var graphLevel = [root];
            var x = 0;
            while (graphLevel.length > 0) {
                var nextGraphLevel = [];
                var y = rootY;
                try {
                    for (var graphLevel_1 = (e_2 = void 0, __values(graphLevel)), graphLevel_1_1 = graphLevel_1.next(); !graphLevel_1_1.done; graphLevel_1_1 = graphLevel_1.next()) {
                        var node = graphLevel_1_1.value;
                        if (alreadyPositioned[node.id]) {
                            continue;
                        }
                        // Initialize positions based on the spacing in the grid
                        node.x = x;
                        node.y = y;
                        alreadyPositioned[node.id] = true;
                        // Move to next Y position for next node
                        y += nodeYSpacing;
                        if (edgesMap[node.id]) {
                            nextGraphLevel.push.apply(nextGraphLevel, __spreadArray([], __read(edgesMap[node.id].map(function (edge) { return nodesMap[edge.target]; })), false));
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (graphLevel_1_1 && !graphLevel_1_1.done && (_b = graphLevel_1.return)) _b.call(graphLevel_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                graphLevel = nextGraphLevel;
                // Move to next X position for next level
                x += nodeXSpacing;
                // Reset Y back to baseline for this root
                y = rootY;
            }
            rootY += rootYSpacing;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (roots_1_1 && !roots_1_1.done && (_a = roots_1.return)) _a.call(roots_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return { roots: roots, secondLevelRoots: secondLevelRoots };
}
/**
 * Makes sure that the center of the graph based on it's bound is in 0, 0 coordinates.
 * Modifies the nodes directly.
 */
function centerNodes(nodes) {
    var e_3, _a;
    var bounds = graphBounds(nodes);
    try {
        for (var nodes_1 = __values(nodes), nodes_1_1 = nodes_1.next(); !nodes_1_1.done; nodes_1_1 = nodes_1.next()) {
            var node = nodes_1_1.value;
            node.x = node.x - bounds.center.x;
            node.y = node.y - bounds.center.y;
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (nodes_1_1 && !nodes_1_1.done && (_a = nodes_1.return)) _a.call(nodes_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
}
/**
 * Get bounds of the graph meaning the extent of the nodes in all directions.
 */
function graphBounds(nodes) {
    if (nodes.length === 0) {
        return { top: 0, right: 0, bottom: 0, left: 0, center: { x: 0, y: 0 } };
    }
    var bounds = nodes.reduce(function (acc, node) {
        if (node.x > acc.right) {
            acc.right = node.x;
        }
        if (node.x < acc.left) {
            acc.left = node.x;
        }
        if (node.y > acc.bottom) {
            acc.bottom = node.y;
        }
        if (node.y < acc.top) {
            acc.top = node.y;
        }
        return acc;
    }, { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity });
    var y = bounds.top + (bounds.bottom - bounds.top) / 2;
    var x = bounds.left + (bounds.right - bounds.left) / 2;
    return __assign(__assign({}, bounds), { center: {
            x: x,
            y: y,
        } });
}
//# sourceMappingURL=layout.worker.js.map