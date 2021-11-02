import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { memo, useCallback, useMemo, useState } from 'react';
import cx from 'classnames';
import useMeasure from 'react-use/lib/useMeasure';
import { Icon, Spinner, useStyles2, useTheme2 } from '@grafana/ui';
import { usePanning } from './usePanning';
import { Node } from './Node';
import { Edge } from './Edge';
import { ViewControls } from './ViewControls';
import { useZoom } from './useZoom';
import { defaultConfig, useLayout } from './layout';
import { EdgeArrowMarker } from './EdgeArrowMarker';
import { css } from '@emotion/css';
import { useCategorizeFrames } from './useCategorizeFrames';
import { EdgeLabel } from './EdgeLabel';
import { useContextMenu } from './useContextMenu';
import { processNodes } from './utils';
import { Marker } from './Marker';
import { Legend } from './Legend';
import { useHighlight } from './useHighlight';
import { useFocusPositionOnLayout } from './useFocusPositionOnLayout';
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: wrapper;\n    height: 100%;\n    width: 100%;\n    overflow: hidden;\n    position: relative;\n  "], ["\n    label: wrapper;\n    height: 100%;\n    width: 100%;\n    overflow: hidden;\n    position: relative;\n  "]))),
    svg: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: svg;\n    height: 100%;\n    width: 100%;\n    overflow: visible;\n    font-size: 10px;\n    cursor: move;\n  "], ["\n    label: svg;\n    height: 100%;\n    width: 100%;\n    overflow: visible;\n    font-size: 10px;\n    cursor: move;\n  "]))),
    svgPanning: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: svgPanning;\n    user-select: none;\n  "], ["\n    label: svgPanning;\n    user-select: none;\n  "]))),
    mainGroup: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    label: mainGroup;\n    will-change: transform;\n  "], ["\n    label: mainGroup;\n    will-change: transform;\n  "]))),
    viewControls: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    label: viewControls;\n    position: absolute;\n    left: 2px;\n    bottom: 3px;\n    right: 0;\n    display: flex;\n    align-items: flex-end;\n    justify-content: space-between;\n    pointer-events: none;\n  "], ["\n    label: viewControls;\n    position: absolute;\n    left: 2px;\n    bottom: 3px;\n    right: 0;\n    display: flex;\n    align-items: flex-end;\n    justify-content: space-between;\n    pointer-events: none;\n  "]))),
    legend: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    label: legend;\n    background: ", ";\n    box-shadow: ", ";\n    padding-bottom: 5px;\n    margin-right: 10px;\n  "], ["\n    label: legend;\n    background: ", ";\n    box-shadow: ", ";\n    padding-bottom: 5px;\n    margin-right: 10px;\n  "])), theme.colors.background.secondary, theme.shadows.z1),
    alert: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    label: alert;\n    padding: 5px 8px;\n    font-size: 10px;\n    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);\n    border-radius: ", ";\n    align-items: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    background: ", ";\n    color: ", ";\n  "], ["\n    label: alert;\n    padding: 5px 8px;\n    font-size: 10px;\n    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);\n    border-radius: ", ";\n    align-items: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    background: ", ";\n    color: ", ";\n  "])), theme.shape.borderRadius(), theme.colors.warning.main, theme.colors.warning.contrastText),
    loadingWrapper: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    label: loadingWrapper;\n    height: 100%;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n  "], ["\n    label: loadingWrapper;\n    height: 100%;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n  "]))),
}); };
// Limits the number of visible nodes, mainly for performance reasons. Nodes above the limit are accessible by expanding
// parts of the graph. The specific number is arbitrary but should be a number of nodes where panning, zooming and other
// interactions will be without any lag for most users.
var defaultNodeCountLimit = 200;
export function NodeGraph(_a) {
    var getLinks = _a.getLinks, dataFrames = _a.dataFrames, nodeLimit = _a.nodeLimit;
    var nodeCountLimit = nodeLimit || defaultNodeCountLimit;
    var _b = useCategorizeFrames(dataFrames), edgesDataFrames = _b.edges, nodesDataFrames = _b.nodes;
    var _c = __read(useMeasure(), 2), measureRef = _c[0], _d = _c[1], width = _d.width, height = _d.height;
    var _e = __read(useState(defaultConfig), 2), config = _e[0], setConfig = _e[1];
    // We need hover state here because for nodes we also highlight edges and for edges have labels separate to make
    // sure they are visible on top of everything else
    var _f = useHover(), nodeHover = _f.nodeHover, setNodeHover = _f.setNodeHover, clearNodeHover = _f.clearNodeHover, edgeHover = _f.edgeHover, setEdgeHover = _f.setEdgeHover, clearEdgeHover = _f.clearEdgeHover;
    var firstNodesDataFrame = nodesDataFrames[0];
    var firstEdgesDataFrame = edgesDataFrames[0];
    var theme = useTheme2();
    // TODO we should be able to allow multiple dataframes for both edges and nodes, could be issue with node ids which in
    //  that case should be unique or figure a way to link edges and nodes dataframes together.
    var processed = useMemo(function () { return processNodes(firstNodesDataFrame, firstEdgesDataFrame, theme); }, [
        firstEdgesDataFrame,
        firstNodesDataFrame,
        theme,
    ]);
    // This is used for navigation from grid to graph view. This node will be centered and briefly highlighted.
    var _g = __read(useState(), 2), focusedNodeId = _g[0], setFocusedNodeId = _g[1];
    var setFocused = useCallback(function (e, m) { return setFocusedNodeId(m.node.id); }, [setFocusedNodeId]);
    // May seem weird that we do layout first and then limit the nodes shown but the problem is we want to keep the node
    // position stable which means we need the full layout first and then just visually hide the nodes. As hiding/showing
    // nodes should not have effect on layout it should not be recalculated.
    var _h = useLayout(processed.nodes, processed.edges, config, nodeCountLimit, width, focusedNodeId), nodes = _h.nodes, edges = _h.edges, markers = _h.markers, bounds = _h.bounds, hiddenNodesCount = _h.hiddenNodesCount, loading = _h.loading;
    // If we move from grid to graph layout and we have focused node lets get it's position to center there. We want do
    // do it specifically only in that case.
    var focusPosition = useFocusPositionOnLayout(config, nodes, focusedNodeId);
    var _j = usePanAndZoom(bounds, focusPosition), panRef = _j.panRef, zoomRef = _j.zoomRef, onStepUp = _j.onStepUp, onStepDown = _j.onStepDown, isPanning = _j.isPanning, position = _j.position, scale = _j.scale, isMaxZoom = _j.isMaxZoom, isMinZoom = _j.isMinZoom;
    var _k = useContextMenu(getLinks, firstNodesDataFrame, firstEdgesDataFrame, config, setConfig, setFocusedNodeId), onEdgeOpen = _k.onEdgeOpen, onNodeOpen = _k.onNodeOpen, MenuComponent = _k.MenuComponent;
    var styles = useStyles2(getStyles);
    // This cannot be inline func or it will create infinite render cycle.
    var topLevelRef = useCallback(function (r) {
        measureRef(r);
        zoomRef.current = r;
    }, [measureRef, zoomRef]);
    var highlightId = useHighlight(focusedNodeId);
    return (React.createElement("div", { ref: topLevelRef, className: styles.wrapper },
        loading ? (React.createElement("div", { className: styles.loadingWrapper },
            "Computing layout\u00A0",
            React.createElement(Spinner, null))) : null,
        React.createElement("svg", { ref: panRef, viewBox: -(width / 2) + " " + -(height / 2) + " " + width + " " + height, className: cx(styles.svg, isPanning && styles.svgPanning) },
            React.createElement("g", { className: styles.mainGroup, style: { transform: "scale(" + scale + ") translate(" + Math.floor(position.x) + "px, " + Math.floor(position.y) + "px)" } },
                React.createElement(EdgeArrowMarker, null),
                !config.gridLayout && (React.createElement(Edges, { edges: edges, nodeHoveringId: nodeHover, edgeHoveringId: edgeHover, onClick: onEdgeOpen, onMouseEnter: setEdgeHover, onMouseLeave: clearEdgeHover })),
                React.createElement(Nodes, { nodes: nodes, onMouseEnter: setNodeHover, onMouseLeave: clearNodeHover, onClick: onNodeOpen, hoveringId: nodeHover || highlightId }),
                React.createElement(Markers, { markers: markers || [], onClick: setFocused }),
                !config.gridLayout && React.createElement(EdgeLabels, { edges: edges, nodeHoveringId: nodeHover, edgeHoveringId: edgeHover }))),
        React.createElement("div", { className: styles.viewControls },
            nodes.length && (React.createElement("div", { className: styles.legend },
                React.createElement(Legend, { sortable: config.gridLayout, nodes: nodes, sort: config.sort, onSort: function (sort) {
                        setConfig(__assign(__assign({}, config), { sort: sort }));
                    } }))),
            React.createElement(ViewControls, { config: config, onConfigChange: function (cfg) {
                    if (cfg.gridLayout !== config.gridLayout) {
                        setFocusedNodeId(undefined);
                    }
                    setConfig(cfg);
                }, onMinus: onStepDown, onPlus: onStepUp, scale: scale, disableZoomIn: isMaxZoom, disableZoomOut: isMinZoom })),
        hiddenNodesCount > 0 && (React.createElement("div", { className: styles.alert, "aria-label": 'Nodes hidden warning' },
            React.createElement(Icon, { size: "sm", name: 'info-circle' }),
            " ",
            hiddenNodesCount,
            " nodes are hidden for performance reasons.")),
        MenuComponent));
}
var Nodes = memo(function Nodes(props) {
    return (React.createElement(React.Fragment, null, props.nodes.map(function (n) { return (React.createElement(Node, { key: n.id, node: n, onMouseEnter: props.onMouseEnter, onMouseLeave: props.onMouseLeave, onClick: props.onClick, hovering: props.hoveringId === n.id })); })));
});
var Markers = memo(function Nodes(props) {
    return (React.createElement(React.Fragment, null, props.markers.map(function (m) { return (React.createElement(Marker, { key: 'marker-' + m.node.id, marker: m, onClick: props.onClick })); })));
});
var Edges = memo(function Edges(props) {
    return (React.createElement(React.Fragment, null, props.edges.map(function (e) { return (React.createElement(Edge, { key: e.id, edge: e, hovering: e.source.id === props.nodeHoveringId ||
            e.target.id === props.nodeHoveringId ||
            props.edgeHoveringId === e.id, onClick: props.onClick, onMouseEnter: props.onMouseEnter, onMouseLeave: props.onMouseLeave })); })));
});
var EdgeLabels = memo(function EdgeLabels(props) {
    return (React.createElement(React.Fragment, null, props.edges.map(function (e, index) {
        var shouldShow = e.source.id === props.nodeHoveringId ||
            e.target.id === props.nodeHoveringId ||
            props.edgeHoveringId === e.id;
        var hasStats = e.mainStat || e.secondaryStat;
        return shouldShow && hasStats && React.createElement(EdgeLabel, { key: e.id, edge: e });
    })));
});
function usePanAndZoom(bounds, focus) {
    var _a = useZoom(), scale = _a.scale, onStepDown = _a.onStepDown, onStepUp = _a.onStepUp, ref = _a.ref, isMax = _a.isMax, isMin = _a.isMin;
    var _b = usePanning({
        scale: scale,
        bounds: bounds,
        focus: focus,
    }), panningState = _b.state, panRef = _b.ref;
    var position = panningState.position, isPanning = panningState.isPanning;
    return { zoomRef: ref, panRef: panRef, position: position, isPanning: isPanning, scale: scale, onStepDown: onStepDown, onStepUp: onStepUp, isMaxZoom: isMax, isMinZoom: isMin };
}
function useHover() {
    var _a = __read(useState(undefined), 2), nodeHover = _a[0], setNodeHover = _a[1];
    var clearNodeHover = useCallback(function () { return setNodeHover(undefined); }, [setNodeHover]);
    var _b = __read(useState(undefined), 2), edgeHover = _b[0], setEdgeHover = _b[1];
    var clearEdgeHover = useCallback(function () { return setEdgeHover(undefined); }, [setEdgeHover]);
    return { nodeHover: nodeHover, setNodeHover: setNodeHover, clearNodeHover: clearNodeHover, edgeHover: edgeHover, setEdgeHover: setEdgeHover, clearEdgeHover: clearEdgeHover };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=NodeGraph.js.map