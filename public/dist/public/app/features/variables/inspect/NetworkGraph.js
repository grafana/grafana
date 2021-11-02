import { __assign, __awaiter, __generator } from "tslib";
import React, { useCallback, useEffect, useRef } from 'react';
export var NetworkGraph = function (_a) {
    var nodes = _a.nodes, edges = _a.edges, direction = _a.direction, width = _a.width, height = _a.height, onDoubleClick = _a.onDoubleClick;
    var network = useRef(null);
    var ref = useRef(null);
    var onNodeDoubleClick = useCallback(function (params) {
        if (onDoubleClick) {
            onDoubleClick(params.nodes[0]);
        }
    }, [onDoubleClick]);
    useEffect(function () {
        var createNetwork = function () { return __awaiter(void 0, void 0, void 0, function () {
            var visJs, data, options;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, import(/* webpackChunkName: "visjs-network" */ 'visjs-network')];
                    case 1:
                        visJs = _b.sent();
                        data = {
                            nodes: toVisNetworkNodes(visJs, nodes),
                            edges: toVisNetworkEdges(visJs, edges),
                        };
                        options = {
                            width: '100%',
                            height: '100%',
                            autoResize: true,
                            layout: {
                                improvedLayout: true,
                                hierarchical: {
                                    enabled: true,
                                    direction: direction !== null && direction !== void 0 ? direction : 'DU',
                                    sortMethod: 'directed',
                                },
                            },
                            interaction: {
                                navigationButtons: true,
                                dragNodes: false,
                            },
                        };
                        network.current = new visJs.Network(ref.current, data, options);
                        (_a = network.current) === null || _a === void 0 ? void 0 : _a.on('doubleClick', onNodeDoubleClick);
                        return [2 /*return*/];
                }
            });
        }); };
        createNetwork();
        return function () {
            // unsubscribe event handlers
            if (network.current) {
                network.current.off('doubleClick');
            }
        };
    }, [direction, edges, nodes, onNodeDoubleClick]);
    return (React.createElement("div", null,
        React.createElement("div", { ref: ref, style: { width: width !== null && width !== void 0 ? width : '100%', height: height !== null && height !== void 0 ? height : '60vh' } })));
};
function toVisNetworkNodes(visJs, nodes) {
    var nodesWithStyle = nodes.map(function (node) { return (__assign(__assign({}, node), { shape: 'box' })); });
    return new visJs.DataSet(nodesWithStyle);
}
function toVisNetworkEdges(visJs, edges) {
    var edgesWithStyle = edges.map(function (edge) { return (__assign(__assign({}, edge), { arrows: 'to', dashes: true })); });
    return new visJs.DataSet(edgesWithStyle);
}
//# sourceMappingURL=NetworkGraph.js.map