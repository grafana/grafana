import React, { memo, MouseEvent, MutableRefObject, useCallback, useMemo, useState } from 'react';
import cx from 'classnames';
import useMeasure from 'react-use/lib/useMeasure';
import { Icon, Spinner, useStyles2, useTheme2 } from '@grafana/ui';
import { usePanning } from './usePanning';
import { EdgeDatum, NodeDatum, NodesMarker } from './types';
import { Node } from './Node';
import { Edge } from './Edge';
import { ViewControls } from './ViewControls';
import { DataFrame, GrafanaTheme2, LinkModel } from '@grafana/data';
import { useZoom } from './useZoom';
import { Config, defaultConfig, useLayout } from './layout';
import { EdgeArrowMarker } from './EdgeArrowMarker';
import { css } from '@emotion/css';
import { useCategorizeFrames } from './useCategorizeFrames';
import { EdgeLabel } from './EdgeLabel';
import { useContextMenu } from './useContextMenu';
import { processNodes, Bounds } from './utils';
import { Marker } from './Marker';
import { Legend } from './Legend';
import { useHighlight } from './useHighlight';
import { useFocusPositionOnLayout } from './useFocusPositionOnLayout';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    label: wrapper;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
  `,

  svg: css`
    label: svg;
    height: 100%;
    width: 100%;
    overflow: visible;
    font-size: 10px;
    cursor: move;
  `,

  svgPanning: css`
    label: svgPanning;
    user-select: none;
  `,

  mainGroup: css`
    label: mainGroup;
    will-change: transform;
  `,

  viewControls: css`
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
  legend: css`
    label: legend;
    background: ${theme.colors.background.secondary};
    box-shadow: ${theme.shadows.z1};
    padding-bottom: 5px;
    margin-right: 10px;
  `,
  alert: css`
    label: alert;
    padding: 5px 8px;
    font-size: 10px;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
    border-radius: ${theme.shape.borderRadius()};
    align-items: center;
    position: absolute;
    top: 0;
    right: 0;
    background: ${theme.colors.warning.main};
    color: ${theme.colors.warning.contrastText};
  `,
  loadingWrapper: css`
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

interface Props {
  dataFrames: DataFrame[];
  getLinks: (dataFrame: DataFrame, rowIndex: number) => LinkModel[];
  nodeLimit?: number;
}
export function NodeGraph({ getLinks, dataFrames, nodeLimit }: Props) {
  const nodeCountLimit = nodeLimit || defaultNodeCountLimit;
  const { edges: edgesDataFrames, nodes: nodesDataFrames } = useCategorizeFrames(dataFrames);

  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>(defaultConfig);

  // We need hover state here because for nodes we also highlight edges and for edges have labels separate to make
  // sure they are visible on top of everything else
  const { nodeHover, setNodeHover, clearNodeHover, edgeHover, setEdgeHover, clearEdgeHover } = useHover();

  const firstNodesDataFrame = nodesDataFrames[0];
  const firstEdgesDataFrame = edgesDataFrames[0];

  const theme = useTheme2();

  // TODO we should be able to allow multiple dataframes for both edges and nodes, could be issue with node ids which in
  //  that case should be unique or figure a way to link edges and nodes dataframes together.
  const processed = useMemo(() => processNodes(firstNodesDataFrame, firstEdgesDataFrame, theme), [
    firstEdgesDataFrame,
    firstNodesDataFrame,
    theme,
  ]);

  // This is used for navigation from grid to graph view. This node will be centered and briefly highlighted.
  const [focusedNodeId, setFocusedNodeId] = useState<string>();
  const setFocused = useCallback((e: MouseEvent, m: NodesMarker) => setFocusedNodeId(m.node.id), [setFocusedNodeId]);

  // May seem weird that we do layout first and then limit the nodes shown but the problem is we want to keep the node
  // position stable which means we need the full layout first and then just visually hide the nodes. As hiding/showing
  // nodes should not have effect on layout it should not be recalculated.
  const { nodes, edges, markers, bounds, hiddenNodesCount, loading } = useLayout(
    processed.nodes,
    processed.edges,
    config,
    nodeCountLimit,
    width,
    focusedNodeId
  );

  // If we move from grid to graph layout and we have focused node lets get it's position to center there. We want do
  // do it specifically only in that case.
  const focusPosition = useFocusPositionOnLayout(config, nodes, focusedNodeId);
  const { panRef, zoomRef, onStepUp, onStepDown, isPanning, position, scale, isMaxZoom, isMinZoom } = usePanAndZoom(
    bounds,
    focusPosition
  );

  const { onEdgeOpen, onNodeOpen, MenuComponent } = useContextMenu(
    getLinks,
    firstNodesDataFrame,
    firstEdgesDataFrame,
    config,
    setConfig,
    setFocusedNodeId
  );
  const styles = useStyles2(getStyles);

  // This cannot be inline func or it will create infinite render cycle.
  const topLevelRef = useCallback(
    (r) => {
      measureRef(r);
      (zoomRef as MutableRefObject<HTMLElement | null>).current = r;
    },
    [measureRef, zoomRef]
  );

  const highlightId = useHighlight(focusedNodeId);

  return (
    <div ref={topLevelRef} className={styles.wrapper}>
      {loading ? (
        <div className={styles.loadingWrapper}>
          Computing layout&nbsp;
          <Spinner />
        </div>
      ) : null}

      <svg
        ref={panRef}
        viewBox={`${-(width / 2)} ${-(height / 2)} ${width} ${height}`}
        className={cx(styles.svg, isPanning && styles.svgPanning)}
      >
        <g
          className={styles.mainGroup}
          style={{ transform: `scale(${scale}) translate(${Math.floor(position.x)}px, ${Math.floor(position.y)}px)` }}
        >
          <EdgeArrowMarker />
          {!config.gridLayout && (
            <Edges
              edges={edges}
              nodeHoveringId={nodeHover}
              edgeHoveringId={edgeHover}
              onClick={onEdgeOpen}
              onMouseEnter={setEdgeHover}
              onMouseLeave={clearEdgeHover}
            />
          )}
          <Nodes
            nodes={nodes}
            onMouseEnter={setNodeHover}
            onMouseLeave={clearNodeHover}
            onClick={onNodeOpen}
            hoveringId={nodeHover || highlightId}
          />

          <Markers markers={markers || []} onClick={setFocused} />
          {/*We split the labels from edges so that they are shown on top of everything else*/}
          {!config.gridLayout && <EdgeLabels edges={edges} nodeHoveringId={nodeHover} edgeHoveringId={edgeHover} />}
        </g>
      </svg>

      <div className={styles.viewControls}>
        {nodes.length && (
          <div className={styles.legend}>
            <Legend
              sortable={config.gridLayout}
              nodes={nodes}
              sort={config.sort}
              onSort={(sort) => {
                setConfig({
                  ...config,
                  sort: sort,
                });
              }}
            />
          </div>
        )}

        <ViewControls<Config>
          config={config}
          onConfigChange={(cfg) => {
            if (cfg.gridLayout !== config.gridLayout) {
              setFocusedNodeId(undefined);
            }
            setConfig(cfg);
          }}
          onMinus={onStepDown}
          onPlus={onStepUp}
          scale={scale}
          disableZoomIn={isMaxZoom}
          disableZoomOut={isMinZoom}
        />
      </div>

      {hiddenNodesCount > 0 && (
        <div className={styles.alert} aria-label={'Nodes hidden warning'}>
          <Icon size="sm" name={'info-circle'} /> {hiddenNodesCount} nodes are hidden for performance reasons.
        </div>
      )}

      {MenuComponent}
    </div>
  );
}

// These components are here as a perf optimisation to prevent going through all nodes and edges on every pan/zoom.

interface NodesProps {
  nodes: NodeDatum[];
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  onClick: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
  hoveringId?: string;
}
const Nodes = memo(function Nodes(props: NodesProps) {
  return (
    <>
      {props.nodes.map((n) => (
        <Node
          key={n.id}
          node={n}
          onMouseEnter={props.onMouseEnter}
          onMouseLeave={props.onMouseLeave}
          onClick={props.onClick}
          hovering={props.hoveringId === n.id}
        />
      ))}
    </>
  );
});

interface MarkersProps {
  markers: NodesMarker[];
  onClick: (event: MouseEvent<SVGElement>, marker: NodesMarker) => void;
}
const Markers = memo(function Nodes(props: MarkersProps) {
  return (
    <>
      {props.markers.map((m) => (
        <Marker key={'marker-' + m.node.id} marker={m} onClick={props.onClick} />
      ))}
    </>
  );
});

interface EdgesProps {
  edges: EdgeDatum[];
  nodeHoveringId?: string;
  edgeHoveringId?: string;
  onClick: (event: MouseEvent<SVGElement>, link: EdgeDatum) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
}
const Edges = memo(function Edges(props: EdgesProps) {
  return (
    <>
      {props.edges.map((e) => (
        <Edge
          key={e.id}
          edge={e}
          hovering={
            (e.source as NodeDatum).id === props.nodeHoveringId ||
            (e.target as NodeDatum).id === props.nodeHoveringId ||
            props.edgeHoveringId === e.id
          }
          onClick={props.onClick}
          onMouseEnter={props.onMouseEnter}
          onMouseLeave={props.onMouseLeave}
        />
      ))}
    </>
  );
});

interface EdgeLabelsProps {
  edges: EdgeDatum[];
  nodeHoveringId?: string;
  edgeHoveringId?: string;
}
const EdgeLabels = memo(function EdgeLabels(props: EdgeLabelsProps) {
  return (
    <>
      {props.edges.map((e, index) => {
        const shouldShow =
          (e.source as NodeDatum).id === props.nodeHoveringId ||
          (e.target as NodeDatum).id === props.nodeHoveringId ||
          props.edgeHoveringId === e.id;
        const hasStats = e.mainStat || e.secondaryStat;
        return shouldShow && hasStats && <EdgeLabel key={e.id} edge={e} />;
      })}
    </>
  );
});

function usePanAndZoom(bounds: Bounds, focus?: { x: number; y: number }) {
  const { scale, onStepDown, onStepUp, ref, isMax, isMin } = useZoom();
  const { state: panningState, ref: panRef } = usePanning<SVGSVGElement>({
    scale,
    bounds,
    focus,
  });
  const { position, isPanning } = panningState;
  return { zoomRef: ref, panRef, position, isPanning, scale, onStepDown, onStepUp, isMaxZoom: isMax, isMinZoom: isMin };
}

function useHover() {
  const [nodeHover, setNodeHover] = useState<string | undefined>(undefined);
  const clearNodeHover = useCallback(() => setNodeHover(undefined), [setNodeHover]);
  const [edgeHover, setEdgeHover] = useState<string | undefined>(undefined);
  const clearEdgeHover = useCallback(() => setEdgeHover(undefined), [setEdgeHover]);

  return { nodeHover, setNodeHover, clearNodeHover, edgeHover, setEdgeHover, clearEdgeHover };
}
