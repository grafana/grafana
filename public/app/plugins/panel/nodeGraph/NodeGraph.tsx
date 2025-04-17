import { css } from '@emotion/css';
import cx from 'classnames';
import { memo, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useMeasure from 'react-use/lib/useMeasure';

import { DataFrame, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Icon, RadioButtonGroup, Spinner, useStyles2 } from '@grafana/ui';

import { Edge } from './Edge';
import { EdgeLabel } from './EdgeLabel';
import { Legend } from './Legend';
import { Marker } from './Marker';
import { Node } from './Node';
import { ViewControls } from './ViewControls';
import { Config, defaultConfig, useLayout, LayoutCache } from './layout';
import { LayoutAlgorithm } from './panelcfg.gen';
import { EdgeDatumLayout, NodeDatum, NodesMarker, ZoomMode } from './types';
import { useCategorizeFrames } from './useCategorizeFrames';
import { useContextMenu } from './useContextMenu';
import { useFocusPositionOnLayout } from './useFocusPositionOnLayout';
import { useHighlight } from './useHighlight';
import { usePanning } from './usePanning';
import { useZoom } from './useZoom';
import { processNodes, Bounds, findConnectedNodesForEdge, findConnectedNodesForNode } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'wrapper',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  }),

  svg: css({
    label: 'svg',
    height: '100%',
    width: '100%',
    overflow: 'visible',
    fontSize: '10px',
    cursor: 'move',
  }),

  svgPanning: css({
    label: 'svgPanning',
    userSelect: 'none',
  }),

  noDataMsg: css({
    height: '100%',
    width: '100%',
    display: 'grid',
    placeItems: 'center',
    fontSize: theme.typography.h4.fontSize,
    color: theme.colors.text.secondary,
  }),

  mainGroup: css({
    label: 'mainGroup',
    willChange: 'transform',
  }),

  viewControls: css({
    label: 'viewControls',
    position: 'absolute',
    left: '2px',
    bottom: '3px',
    right: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  }),
  layoutAlgorithm: css({
    label: 'layoutAlgorithm',
    pointerEvents: 'all',
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 1,
  }),
  legend: css({
    label: 'legend',
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z1,
    paddingBottom: '5px',
    marginRight: '10px',
  }),
  viewControlsWrapper: css({
    marginLeft: 'auto',
  }),
  alert: css({
    label: 'alert',
    padding: '5px 8px',
    fontSize: '10px',
    textShadow: '0 1px 0 rgba(0, 0, 0, 0.2)',
    borderRadius: theme.shape.radius.default,
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    background: theme.colors.warning.main,
    color: theme.colors.warning.contrastText,
  }),
  loadingWrapper: css({
    label: 'loadingWrapper',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
});

// Limits the number of visible nodes, mainly for performance reasons. Nodes above the limit are accessible by expanding
// parts of the graph. The specific number is arbitrary but should be a number of nodes where panning, zooming and other
// interactions will be without any lag for most users.
const defaultNodeCountLimit = 200;

export const layeredLayoutThreshold = 500;

interface Props {
  dataFrames: DataFrame[];
  getLinks: (dataFrame: DataFrame, rowIndex: number) => LinkModel[];
  nodeLimit?: number;
  panelId?: string;
  zoomMode?: ZoomMode;
  layoutAlgorithm?: LayoutAlgorithm;
}
export function NodeGraph({ getLinks, dataFrames, nodeLimit, panelId, zoomMode, layoutAlgorithm }: Props) {
  const nodeCountLimit = nodeLimit || defaultNodeCountLimit;
  const { edges: edgesDataFrames, nodes: nodesDataFrames } = useCategorizeFrames(dataFrames);

  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>(defaultConfig);

  // Layout cache to avoid recalculating layouts
  const layoutCacheRef = useRef<LayoutCache>({});

  // Update the config when layoutAlgorithm changes via the panel options
  useEffect(() => {
    if (layoutAlgorithm) {
      setConfig((prevConfig) => {
        return {
          ...prevConfig,
          gridLayout: layoutAlgorithm === LayoutAlgorithm.Grid,
          layoutAlgorithm,
        };
      });
    }
  }, [layoutAlgorithm]);

  const firstNodesDataFrame = nodesDataFrames[0];
  const firstEdgesDataFrame = edgesDataFrames[0];

  // Ensure we use unique IDs for the marker tip elements, since IDs are global
  // in the entire HTML document. This prevents hidden tips when an earlier
  // occurence is hidden (editor is open in front of an existing node graph
  // panel) or when the earlier tips have different properties (color, size, or
  // shape for example).
  const svgIdNamespace = panelId || 'nodegraphpanel';

  // TODO we should be able to allow multiple dataframes for both edges and nodes, could be issue with node ids which in
  //  that case should be unique or figure a way to link edges and nodes dataframes together.
  const processed = useMemo(
    () => processNodes(firstNodesDataFrame, firstEdgesDataFrame),
    [firstEdgesDataFrame, firstNodesDataFrame]
  );

  // We need hover state here because for nodes we also highlight edges and for edges have labels separate to make
  // sure they are visible on top of everything else
  const { nodeHover, setNodeHover, clearNodeHover, edgeHover, setEdgeHover, clearEdgeHover } = useHover();
  const [hoveringIds, setHoveringIds] = useState<string[]>([]);
  useEffect(() => {
    let linked: string[] = [];
    if (nodeHover) {
      linked = findConnectedNodesForNode(processed.nodes, processed.edges, nodeHover);
    } else if (edgeHover) {
      linked = findConnectedNodesForEdge(processed.nodes, processed.edges, edgeHover);
    }
    setHoveringIds(linked);
  }, [nodeHover, edgeHover, processed]);

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
    focusedNodeId,
    processed.hasFixedPositions,
    layoutCacheRef.current
  );

  // If we move from grid to graph layout, and we have focused node lets get its position to center there. We want to
  // do it specifically only in that case.
  const focusPosition = useFocusPositionOnLayout(config, nodes, focusedNodeId);
  const { panRef, zoomRef, onStepUp, onStepDown, isPanning, position, scale, isMaxZoom, isMinZoom } = usePanAndZoom(
    bounds,
    focusPosition,
    zoomMode
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

  // This cannot be inline func, or it will create infinite render cycle.
  const topLevelRef = useCallback(
    (r: HTMLDivElement) => {
      measureRef(r);
      zoomRef.current = r;
    },
    [measureRef, zoomRef]
  );

  const highlightId = useHighlight(focusedNodeId);

  const handleLayoutChange = (cfg: Config) => {
    if (cfg.layoutAlgorithm !== config.layoutAlgorithm) {
      setFocusedNodeId(undefined);
    }
    setConfig(cfg);
  };

  // Clear the layout cache when data changes
  useEffect(() => {
    layoutCacheRef.current = {};
  }, [firstNodesDataFrame, firstEdgesDataFrame]);

  return (
    <div ref={topLevelRef} className={styles.wrapper}>
      {loading ? (
        <div className={styles.loadingWrapper}>
          Computing layout&nbsp;
          <Spinner />
        </div>
      ) : null}

      {!panelId && (
        <div className={styles.layoutAlgorithm}>
          <RadioButtonGroup
            size="sm"
            options={[
              { label: 'Layered', value: LayoutAlgorithm.Layered },
              { label: 'Force', value: LayoutAlgorithm.Force },
              { label: 'Grid', value: LayoutAlgorithm.Grid },
            ]}
            value={config.gridLayout ? LayoutAlgorithm.Grid : config.layoutAlgorithm}
            onChange={(value) => {
              handleLayoutChange({
                ...config,
                gridLayout: value === LayoutAlgorithm.Grid,
                layoutAlgorithm: value,
              });
            }}
          />
        </div>
      )}

      {dataFrames.length && processed.nodes.length ? (
        <svg
          ref={panRef}
          viewBox={`${-(width / 2)} ${-(height / 2)} ${width} ${height}`}
          className={cx(styles.svg, isPanning && styles.svgPanning)}
        >
          <g
            className={styles.mainGroup}
            style={{ transform: `scale(${scale}) translate(${Math.floor(position.x)}px, ${Math.floor(position.y)}px)` }}
          >
            {!config.gridLayout && (
              <Edges
                edges={edges}
                nodeHoveringId={nodeHover}
                edgeHoveringId={edgeHover}
                onClick={onEdgeOpen}
                onMouseEnter={setEdgeHover}
                onMouseLeave={clearEdgeHover}
                svgIdNamespace={svgIdNamespace}
                processedNodesLength={processed.nodes.length}
              />
            )}
            <Nodes
              nodes={nodes}
              onMouseEnter={setNodeHover}
              onMouseLeave={clearNodeHover}
              onClick={onNodeOpen}
              hoveringIds={hoveringIds || [highlightId]}
            />

            <Markers markers={markers || []} onClick={setFocused} />
            {/*We split the labels from edges so that they are shown on top of everything else*/}
            {!config.gridLayout && <EdgeLabels edges={edges} nodeHoveringId={nodeHover} edgeHoveringId={edgeHover} />}
          </g>
        </svg>
      ) : (
        <div className={styles.noDataMsg}>No data</div>
      )}

      <div className={styles.viewControls}>
        {nodes.length ? (
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
        ) : null}

        <div className={styles.viewControlsWrapper}>
          <ViewControls<Config>
            config={config}
            onConfigChange={handleLayoutChange}
            onMinus={onStepDown}
            onPlus={onStepUp}
            scale={scale}
            disableZoomIn={isMaxZoom}
            disableZoomOut={isMinZoom}
          />
        </div>
      </div>

      {hiddenNodesCount > 0 && (
        <div
          className={styles.alert}
          style={{ top: panelId ? '0px' : '40px' }} // panelId is undefined in Explore
          aria-label={'Nodes hidden warning'}
        >
          <Icon size="sm" name={'info-circle'} /> {hiddenNodesCount} nodes are hidden for performance reasons.
        </div>
      )}

      {config.layoutAlgorithm === LayoutAlgorithm.Layered && processed.nodes.length > layeredLayoutThreshold && (
        <div
          className={styles.alert}
          style={{ top: panelId ? '30px' : '70px' }}
          aria-label={'Layered layout performance warning'}
        >
          <Icon size="sm" name={'exclamation-triangle'} /> Layered layout may be slow with {processed.nodes.length}{' '}
          nodes.
        </div>
      )}

      {MenuComponent}
    </div>
  );
}

// Active -> emphasized, inactive -> de-emphasized, and default -> normal styling
export type HoverState = 'active' | 'inactive' | 'default';

// These components are here as a perf optimisation to prevent going through all nodes and edges on every pan/zoom.
interface NodesProps {
  nodes: NodeDatum[];
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  onClick: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
  hoveringIds?: string[];
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
          hovering={
            !props.hoveringIds || props.hoveringIds.length === 0
              ? 'default'
              : props.hoveringIds?.includes(n.id)
                ? 'active'
                : 'inactive'
          }
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
  edges: EdgeDatumLayout[];
  nodeHoveringId?: string;
  edgeHoveringId?: string;
  svgIdNamespace: string;
  onClick: (event: MouseEvent<SVGElement>, link: EdgeDatumLayout) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  processedNodesLength: number;
}
const Edges = memo(function Edges(props: EdgesProps) {
  return (
    <>
      {props.edges.map((e) => (
        <Edge
          key={`${e.id}-${e.source.y ?? ''}-${props.processedNodesLength}`}
          edge={e}
          hovering={
            (e.source as NodeDatum).id === props.nodeHoveringId ||
            (e.target as NodeDatum).id === props.nodeHoveringId ||
            props.edgeHoveringId === e.id
          }
          onClick={props.onClick}
          onMouseEnter={props.onMouseEnter}
          onMouseLeave={props.onMouseLeave}
          svgIdNamespace={props.svgIdNamespace}
          processedNodesLength={props.processedNodesLength}
        />
      ))}
    </>
  );
});

interface EdgeLabelsProps {
  edges: EdgeDatumLayout[];
  nodeHoveringId?: string;
  edgeHoveringId?: string;
}
const EdgeLabels = memo(function EdgeLabels(props: EdgeLabelsProps) {
  return (
    <>
      {props.edges.map((e, index) => {
        // We show the edge label in case user hovers over the edge directly or if they hover over node edge is
        // connected to.
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

function usePanAndZoom(bounds: Bounds, focus?: { x: number; y: number }, zoomMode?: ZoomMode) {
  const { scale, onStepDown, onStepUp, ref, isMax, isMin } = useZoom({ zoomMode });
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
