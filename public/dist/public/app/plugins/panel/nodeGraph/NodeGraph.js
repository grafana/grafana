import { css } from '@emotion/css';
import cx from 'classnames';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import useMeasure from 'react-use/lib/useMeasure';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';
import { Edge } from './Edge';
import { EdgeArrowMarker } from './EdgeArrowMarker';
import { EdgeLabel } from './EdgeLabel';
import { Legend } from './Legend';
import { Marker } from './Marker';
import { Node } from './Node';
import { ViewControls } from './ViewControls';
import { defaultConfig, useLayout } from './layout';
import { useCategorizeFrames } from './useCategorizeFrames';
import { useContextMenu } from './useContextMenu';
import { useFocusPositionOnLayout } from './useFocusPositionOnLayout';
import { useHighlight } from './useHighlight';
import { usePanning } from './usePanning';
import { useZoom } from './useZoom';
import { processNodes, findConnectedNodesForEdge, findConnectedNodesForNode } from './utils';
const getStyles = (theme) => ({
    wrapper: css `
    label: wrapper;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
  `,
    svg: css `
    label: svg;
    height: 100%;
    width: 100%;
    overflow: visible;
    font-size: 10px;
    cursor: move;
  `,
    svgPanning: css `
    label: svgPanning;
    user-select: none;
  `,
    noDataMsg: css `
    height: 100%;
    width: 100%;
    display: grid;
    place-items: center;
    font-size: ${theme.typography.h4.fontSize};
    color: ${theme.colors.text.secondary};
  `,
    mainGroup: css `
    label: mainGroup;
    will-change: transform;
  `,
    viewControls: css `
    label: viewControls;
    position: absolute;
    left: 2px;
    bottom: 3px;
    right: 0;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    pointer-events: none;
  `,
    legend: css `
    label: legend;
    background: ${theme.colors.background.secondary};
    box-shadow: ${theme.shadows.z1};
    padding-bottom: 5px;
    margin-right: 10px;
  `,
    viewControlsWrapper: css `
    margin-left: auto;
  `,
    alert: css `
    label: alert;
    padding: 5px 8px;
    font-size: 10px;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
    border-radius: ${theme.shape.radius.default};
    align-items: center;
    position: absolute;
    top: 0;
    right: 0;
    background: ${theme.colors.warning.main};
    color: ${theme.colors.warning.contrastText};
  `,
    loadingWrapper: css `
    label: loadingWrapper;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
});
// Limits the number of visible nodes, mainly for performance reasons. Nodes above the limit are accessible by expanding
// parts of the graph. The specific number is arbitrary but should be a number of nodes where panning, zooming and other
// interactions will be without any lag for most users.
const defaultNodeCountLimit = 200;
export function NodeGraph({ getLinks, dataFrames, nodeLimit }) {
    const nodeCountLimit = nodeLimit || defaultNodeCountLimit;
    const { edges: edgesDataFrames, nodes: nodesDataFrames } = useCategorizeFrames(dataFrames);
    const [measureRef, { width, height }] = useMeasure();
    const [config, setConfig] = useState(defaultConfig);
    const firstNodesDataFrame = nodesDataFrames[0];
    const firstEdgesDataFrame = edgesDataFrames[0];
    // TODO we should be able to allow multiple dataframes for both edges and nodes, could be issue with node ids which in
    //  that case should be unique or figure a way to link edges and nodes dataframes together.
    const processed = useMemo(() => processNodes(firstNodesDataFrame, firstEdgesDataFrame), [firstEdgesDataFrame, firstNodesDataFrame]);
    // We need hover state here because for nodes we also highlight edges and for edges have labels separate to make
    // sure they are visible on top of everything else
    const { nodeHover, setNodeHover, clearNodeHover, edgeHover, setEdgeHover, clearEdgeHover } = useHover();
    const [hoveringIds, setHoveringIds] = useState([]);
    useEffect(() => {
        let linked = [];
        if (nodeHover) {
            linked = findConnectedNodesForNode(processed.nodes, processed.edges, nodeHover);
        }
        else if (edgeHover) {
            linked = findConnectedNodesForEdge(processed.nodes, processed.edges, edgeHover);
        }
        setHoveringIds(linked);
    }, [nodeHover, edgeHover, processed]);
    // This is used for navigation from grid to graph view. This node will be centered and briefly highlighted.
    const [focusedNodeId, setFocusedNodeId] = useState();
    const setFocused = useCallback((e, m) => setFocusedNodeId(m.node.id), [setFocusedNodeId]);
    // May seem weird that we do layout first and then limit the nodes shown but the problem is we want to keep the node
    // position stable which means we need the full layout first and then just visually hide the nodes. As hiding/showing
    // nodes should not have effect on layout it should not be recalculated.
    const { nodes, edges, markers, bounds, hiddenNodesCount, loading } = useLayout(processed.nodes, processed.edges, config, nodeCountLimit, width, focusedNodeId);
    // If we move from grid to graph layout, and we have focused node lets get its position to center there. We want to
    // do it specifically only in that case.
    const focusPosition = useFocusPositionOnLayout(config, nodes, focusedNodeId);
    const { panRef, zoomRef, onStepUp, onStepDown, isPanning, position, scale, isMaxZoom, isMinZoom } = usePanAndZoom(bounds, focusPosition);
    const { onEdgeOpen, onNodeOpen, MenuComponent } = useContextMenu(getLinks, firstNodesDataFrame, firstEdgesDataFrame, config, setConfig, setFocusedNodeId);
    const styles = useStyles2(getStyles);
    // This cannot be inline func, or it will create infinite render cycle.
    const topLevelRef = useCallback((r) => {
        measureRef(r);
        zoomRef.current = r;
    }, [measureRef, zoomRef]);
    const highlightId = useHighlight(focusedNodeId);
    return (React.createElement("div", { ref: topLevelRef, className: styles.wrapper },
        loading ? (React.createElement("div", { className: styles.loadingWrapper },
            "Computing layout\u00A0",
            React.createElement(Spinner, null))) : null,
        dataFrames.length && processed.nodes.length ? (React.createElement("svg", { ref: panRef, viewBox: `${-(width / 2)} ${-(height / 2)} ${width} ${height}`, className: cx(styles.svg, isPanning && styles.svgPanning) },
            React.createElement("g", { className: styles.mainGroup, style: { transform: `scale(${scale}) translate(${Math.floor(position.x)}px, ${Math.floor(position.y)}px)` } },
                React.createElement(EdgeArrowMarker, null),
                !config.gridLayout && (React.createElement(Edges, { edges: edges, nodeHoveringId: nodeHover, edgeHoveringId: edgeHover, onClick: onEdgeOpen, onMouseEnter: setEdgeHover, onMouseLeave: clearEdgeHover })),
                React.createElement(Nodes, { nodes: nodes, onMouseEnter: setNodeHover, onMouseLeave: clearNodeHover, onClick: onNodeOpen, hoveringIds: hoveringIds || [highlightId] }),
                React.createElement(Markers, { markers: markers || [], onClick: setFocused }),
                !config.gridLayout && React.createElement(EdgeLabels, { edges: edges, nodeHoveringId: nodeHover, edgeHoveringId: edgeHover })))) : (React.createElement("div", { className: styles.noDataMsg }, "No data")),
        React.createElement("div", { className: styles.viewControls },
            nodes.length ? (React.createElement("div", { className: styles.legend },
                React.createElement(Legend, { sortable: config.gridLayout, nodes: nodes, sort: config.sort, onSort: (sort) => {
                        setConfig(Object.assign(Object.assign({}, config), { sort: sort }));
                    } }))) : null,
            React.createElement("div", { className: styles.viewControlsWrapper },
                React.createElement(ViewControls, { config: config, onConfigChange: (cfg) => {
                        if (cfg.gridLayout !== config.gridLayout) {
                            setFocusedNodeId(undefined);
                        }
                        setConfig(cfg);
                    }, onMinus: onStepDown, onPlus: onStepUp, scale: scale, disableZoomIn: isMaxZoom, disableZoomOut: isMinZoom }))),
        hiddenNodesCount > 0 && (React.createElement("div", { className: styles.alert, "aria-label": 'Nodes hidden warning' },
            React.createElement(Icon, { size: "sm", name: 'info-circle' }),
            " ",
            hiddenNodesCount,
            " nodes are hidden for performance reasons.")),
        MenuComponent));
}
const Nodes = memo(function Nodes(props) {
    return (React.createElement(React.Fragment, null, props.nodes.map((n) => {
        var _a;
        return (React.createElement(Node, { key: n.id, node: n, onMouseEnter: props.onMouseEnter, onMouseLeave: props.onMouseLeave, onClick: props.onClick, hovering: !props.hoveringIds || props.hoveringIds.length === 0
                ? 'default'
                : ((_a = props.hoveringIds) === null || _a === void 0 ? void 0 : _a.includes(n.id))
                    ? 'active'
                    : 'inactive' }));
    })));
});
const Markers = memo(function Nodes(props) {
    return (React.createElement(React.Fragment, null, props.markers.map((m) => (React.createElement(Marker, { key: 'marker-' + m.node.id, marker: m, onClick: props.onClick })))));
});
const Edges = memo(function Edges(props) {
    return (React.createElement(React.Fragment, null, props.edges.map((e) => (React.createElement(Edge, { key: e.id, edge: e, hovering: e.source.id === props.nodeHoveringId ||
            e.target.id === props.nodeHoveringId ||
            props.edgeHoveringId === e.id, onClick: props.onClick, onMouseEnter: props.onMouseEnter, onMouseLeave: props.onMouseLeave })))));
});
const EdgeLabels = memo(function EdgeLabels(props) {
    return (React.createElement(React.Fragment, null, props.edges.map((e, index) => {
        // We show the edge label in case user hovers over the edge directly or if they hover over node edge is
        // connected to.
        const shouldShow = e.source.id === props.nodeHoveringId ||
            e.target.id === props.nodeHoveringId ||
            props.edgeHoveringId === e.id;
        const hasStats = e.mainStat || e.secondaryStat;
        return shouldShow && hasStats && React.createElement(EdgeLabel, { key: e.id, edge: e });
    })));
});
function usePanAndZoom(bounds, focus) {
    const { scale, onStepDown, onStepUp, ref, isMax, isMin } = useZoom();
    const { state: panningState, ref: panRef } = usePanning({
        scale,
        bounds,
        focus,
    });
    const { position, isPanning } = panningState;
    return { zoomRef: ref, panRef, position, isPanning, scale, onStepDown, onStepUp, isMaxZoom: isMax, isMinZoom: isMin };
}
function useHover() {
    const [nodeHover, setNodeHover] = useState(undefined);
    const clearNodeHover = useCallback(() => setNodeHover(undefined), [setNodeHover]);
    const [edgeHover, setEdgeHover] = useState(undefined);
    const clearEdgeHover = useCallback(() => setEdgeHover(undefined), [setEdgeHover]);
    return { nodeHover, setNodeHover, clearNodeHover, edgeHover, setEdgeHover, clearEdgeHover };
}
//# sourceMappingURL=NodeGraph.js.map