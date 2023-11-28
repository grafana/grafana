import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useRef } from 'react';
export const NetworkGraph = ({ nodes, edges, direction, width, height, onDoubleClick }) => {
    const network = useRef(null);
    const ref = useRef(null);
    const onNodeDoubleClick = useCallback((params) => {
        if (onDoubleClick) {
            onDoubleClick(params.nodes[0]);
        }
    }, [onDoubleClick]);
    useEffect(() => {
        const createNetwork = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // @ts-ignore no types yet for visjs-network
            const visJs = yield import(/* webpackChunkName: "visjs-network" */ 'visjs-network');
            const data = {
                nodes: toVisNetworkNodes(visJs, nodes),
                edges: toVisNetworkEdges(visJs, edges),
            };
            const options = {
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
        });
        createNetwork();
        return () => {
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
    const nodesWithStyle = nodes.map((node) => (Object.assign(Object.assign({}, node), { shape: 'box' })));
    return new visJs.DataSet(nodesWithStyle);
}
function toVisNetworkEdges(visJs, edges) {
    const edgesWithStyle = edges.map((edge) => (Object.assign(Object.assign({}, edge), { arrows: 'to', dashes: true })));
    return new visJs.DataSet(edgesWithStyle);
}
//# sourceMappingURL=NetworkGraph.js.map