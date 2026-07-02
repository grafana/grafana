import { css, cx } from '@emotion/css';
import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { IconButton, useStyles2 } from '@grafana/ui';

import { QueryFlowAnnotations } from './components/QueryFlowAnnotations';
import { QueryFlowEdges } from './components/QueryFlowEdges';
import { QueryFlowNode } from './components/QueryFlowNode';
import { type QueryFlowDiagnostic } from './diagnostics/types';
import { type NodeEnrichment } from './enrichment/types';
import { NODE_HEIGHT, NODE_WIDTH, edgeEndpoints, type PositionedEdge, type QueryFlowLayout } from './layout';
import { type QueryFlowNode as QueryFlowNodeModel } from './model/types';

interface NodeBox {
  x: number;
  y: number;
  height: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const ZOOM_FACTOR = 1.2;

interface Point {
  x: number;
  y: number;
}

type DragState =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { kind: 'node'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean };

interface Props {
  layout: QueryFlowLayout;
  /** Live tips/warnings/errors rendered as floating callouts above their nodes. */
  diagnostics?: QueryFlowDiagnostic[];
  /** Lookup for a node's live enrichment (badge + tooltip), once requested. */
  getEnrichment?: (nodeId: string) => NodeEnrichment | undefined;
  /** Lazily fetch a node's enrichment — wired to each node's hover/focus. */
  onRequestEnrichment?: (nodeId: string) => void;
  /** Called with a node id on hover (or `null` on leave) to highlight its text in the editor. */
  onNodeHover?: (nodeId: string | null) => void;
}

export function QueryFlowCanvas({ layout, diagnostics, getEnrichment, onRequestEnrichment, onNodeHover }: Props) {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  // Ids the user has manually dragged — their position survives layout rebuilds (the query is
  // rebuilt live as the user types) instead of snapping back to the auto-layout position on every
  // keystroke. Nodes not in this set always adopt the fresh auto-layout position, since that's what
  // lets the tree re-flow around nodes that were added or removed.
  const draggedIds = useRef<Set<string>>(new Set());

  // Re-lay out node positions whenever the graph changes. Scale and pan are intentionally preserved
  // so the view doesn't jump on each keystroke; selection is dropped only when the selected node no
  // longer exists. Use the reset control to recenter. Layout effect (not a plain effect) so freshly
  // added nodes never paint a frame at (0, 0) before adopting their computed position.
  useLayoutEffect(() => {
    const next: Record<string, Point> = {};
    for (const positioned of layout.nodes) {
      const id = positioned.node.id;
      const manual = draggedIds.current.has(id) ? positions[id] : undefined;
      next[id] = manual ?? { x: positioned.x, y: positioned.y };
    }
    for (const id of draggedIds.current) {
      if (!next[id]) {
        draggedIds.current.delete(id);
      }
    }
    setPositions(next);
    setSelectedId((current) => (current && next[current] ? current : null));
    // `positions` intentionally excluded: this should only re-run when the layout itself changes,
    // reading the latest committed positions from the closure as the "previous" values to carry
    // forward for dragged nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Refs let the wheel/zoom/drag handlers read the latest view without re-binding listeners — and
  // keep the pointer-down callbacks referentially stable, so the memoized node cards aren't all
  // re-rendered every time a drag updates `positions`.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const panRef = useRef(pan);
  panRef.current = pan;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const drag = useRef<DragState | null>(null);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const state = drag.current;
    if (!state) {
      return;
    }
    const dx = event.clientX - state.sx;
    const dy = event.clientY - state.sy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      state.moved = true;
    }
    if (state.kind === 'pan') {
      setPan({ x: state.ox + dx, y: state.oy + dy });
    } else {
      const s = scaleRef.current;
      const id = state.id;
      setPositions((prev) => ({ ...prev, [id]: { x: state.ox + dx / s, y: state.oy + dy / s } }));
    }
  }, []);

  const endDrag = useCallback(() => {
    const state = drag.current;
    if (state?.kind === 'node' && state.moved) {
      draggedIds.current.add(state.id);
    }
    drag.current = null;
    setIsPanning(false);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onPointerMove]);

  const beginDrag = useCallback(
    (state: DragState) => {
      drag.current = state;
      if (state.kind === 'pan') {
        setIsPanning(true);
      }
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endDrag);
    },
    [onPointerMove, endDrag]
  );

  useEffect(() => endDrag, [endDrag]);

  const onBackgroundPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      setSelectedId(null);
      beginDrag({
        kind: 'pan',
        sx: event.clientX,
        sy: event.clientY,
        ox: panRef.current.x,
        oy: panRef.current.y,
        moved: false,
      });
    },
    [beginDrag]
  );

  const onNodePointerDown = useCallback(
    (event: ReactPointerEvent, id: string) => {
      event.stopPropagation();
      if (event.button !== 0) {
        return;
      }
      setSelectedId(id);
      const current = positionsRef.current[id];
      if (!current) {
        return;
      }
      beginDrag({ kind: 'node', id, sx: event.clientX, sy: event.clientY, ox: current.x, oy: current.y, moved: false });
    },
    [beginDrag]
  );

  // Keyboard-only equivalent of clicking a node (Enter/Space while it's focused).
  const onSelectNode = useCallback((id: string) => setSelectedId(id), []);

  const zoomAround = useCallback((factor: number, clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const s1 = scaleRef.current;
    const s2 = clamp(s1 * factor, MIN_SCALE, MAX_SCALE);
    if (s2 === s1) {
      return;
    }
    const p = panRef.current;
    const cx = (px - p.x) / s1;
    const cy = (py - p.y) / s1;
    setScale(s2);
    setPan({ x: px - cx * s2, y: py - cy * s2 });
  }, []);

  // Wheel zoom (cooperative: only with ctrl/meta so normal scrolling still pages the layout).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      zoomAround(event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR, event.clientX, event.clientY);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      zoomAround(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [zoomAround]
  );

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard equivalents of drag-to-pan and the zoom buttons, for users who can't use a pointer.
  // Only handled when the key lands on the viewport background itself (not bubbled from a focused
  // node card), so arrow keys don't fight with node-to-node tab navigation.
  const onViewportKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      const PAN_STEP = 60;
      switch (event.key) {
        case 'ArrowUp':
          setPan((p) => ({ ...p, y: p.y + PAN_STEP }));
          break;
        case 'ArrowDown':
          setPan((p) => ({ ...p, y: p.y - PAN_STEP }));
          break;
        case 'ArrowLeft':
          setPan((p) => ({ ...p, x: p.x + PAN_STEP }));
          break;
        case 'ArrowRight':
          setPan((p) => ({ ...p, x: p.x - PAN_STEP }));
          break;
        case '+':
        case '=':
          zoomFromCenter(ZOOM_FACTOR);
          break;
        case '-':
          zoomFromCenter(1 / ZOOM_FACTOR);
          break;
        case '0':
          resetView();
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [zoomFromCenter, resetView]
  );

  // Intrinsic node heights are fixed by content, so they're keyed off the layout (not drag state).
  const heightById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const positioned of layout.nodes) {
      map[positioned.node.id] = positioned.height;
    }
    return map;
  }, [layout.nodes]);

  // Content size grows to fit dragged nodes so edges/cards are never clipped by the transformed layer.
  const { width, height } = useMemo(() => {
    let w = layout.width;
    let h = layout.height;
    for (const id of Object.keys(positions)) {
      w = Math.max(w, positions[id].x + NODE_WIDTH);
      h = Math.max(h, positions[id].y + (heightById[id] ?? NODE_HEIGHT));
    }
    return { width: w, height: h };
  }, [positions, heightById, layout.width, layout.height]);

  // Recompute edge endpoints from the live node positions.
  const edges: PositionedEdge[] = useMemo(
    () =>
      layout.edges.map((edge) => {
        const parent = positions[edge.sourceId];
        const child = positions[edge.targetId];
        if (!parent || !child) {
          return edge;
        }
        const parentBox: NodeBox = { ...parent, height: heightById[edge.sourceId] ?? NODE_HEIGHT };
        const childBox: NodeBox = { ...child, height: heightById[edge.targetId] ?? NODE_HEIGHT };
        return { ...edge, ...edgeEndpoints(parentBox, childBox) };
      }),
    [layout.edges, positions, heightById]
  );

  return (
    <div className={styles.root}>
      {/* A pan/zoom surface with its own keyboard handling (arrows/+/-/0), like the geomap panel.
          `application` isn't in jsx-a11y's interactive-role list, but this element genuinely
          implements focus, keyboard, and pointer interaction — hence the targeted disables. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={containerRef}
        className={cx(styles.viewport, isPanning && styles.panning)}
        data-testid="query-flow-graph"
        onPointerDown={onBackgroundPointerDown}
        onKeyDown={onViewportKeyDown}
        role="application"
        tabIndex={0}
        aria-label={t(
          'explore.query-flow.canvas-label',
          'Query flow graph. Use arrow keys to pan, plus and minus to zoom, 0 to reset the view. Tab to move between nodes.'
        )}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div
          className={styles.inner}
          style={{ width, height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          <QueryFlowEdges edges={edges} width={width} height={height} />
          {layout.nodes.map(({ node, height: nodeBoxHeight }) => {
            const pos = positions[node.id] ?? { x: 0, y: 0 };
            return (
              <QueryFlowNodeCard
                key={node.id}
                node={node}
                height={nodeBoxHeight}
                x={pos.x}
                y={pos.y}
                selected={selectedId === node.id}
                enrichment={getEnrichment?.(node.id)}
                onNodePointerDown={onNodePointerDown}
                onSelect={onSelectNode}
                onRequestEnrichment={onRequestEnrichment}
                onNodeHover={onNodeHover}
              />
            );
          })}
          {diagnostics && diagnostics.length > 0 && (
            <QueryFlowAnnotations diagnostics={diagnostics} positions={positions} />
          )}
        </div>
      </div>
      <div className={styles.controls}>
        <IconButton
          name="plus"
          size="sm"
          variant="secondary"
          tooltip={t('explore.query-flow.zoom-in', 'Zoom in')}
          aria-label={t('explore.query-flow.zoom-in', 'Zoom in')}
          onClick={() => {
            reportInteraction('grafana_explore_query_flow_zoom', { direction: 'in' });
            zoomFromCenter(ZOOM_FACTOR);
          }}
        />
        <IconButton
          name="minus"
          size="sm"
          variant="secondary"
          tooltip={t('explore.query-flow.zoom-out', 'Zoom out')}
          aria-label={t('explore.query-flow.zoom-out', 'Zoom out')}
          onClick={() => {
            reportInteraction('grafana_explore_query_flow_zoom', { direction: 'out' });
            zoomFromCenter(1 / ZOOM_FACTOR);
          }}
        />
        <IconButton
          name="compress-arrows"
          size="sm"
          variant="secondary"
          tooltip={t('explore.query-flow.reset-view', 'Reset view')}
          aria-label={t('explore.query-flow.reset-view', 'Reset view')}
          onClick={() => {
            reportInteraction('grafana_explore_query_flow_zoom', { direction: 'reset' });
            resetView();
          }}
        />
      </div>
    </div>
  );
}

interface QueryFlowNodeCardProps {
  node: QueryFlowNodeModel;
  height: number;
  x: number;
  y: number;
  selected: boolean;
  enrichment?: NodeEnrichment;
  onNodePointerDown: (event: ReactPointerEvent, id: string) => void;
  /** Keyboard equivalent of clicking the node (Enter/Space while focused). */
  onSelect: (id: string) => void;
  onRequestEnrichment?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
}

// Memoized draggable wrapper around one node card. `enrichment` is resolved by the caller (not
// passed as a getter + id), so its reference only changes for the node whose enrichment actually
// changed — combined with memo, a lazy enrichment fetch resolving for one node (or a canvas
// re-render from panning/zooming/selecting) no longer re-renders every other node in the graph.
const QueryFlowNodeCard = memo(function QueryFlowNodeCard({
  node,
  height,
  x,
  y,
  selected,
  enrichment,
  onNodePointerDown,
  onSelect,
  onRequestEnrichment,
  onNodeHover,
}: QueryFlowNodeCardProps) {
  const styles = useStyles2(getStyles);
  return (
    <div
      className={cx(styles.node, selected && styles.nodeSelected)}
      style={{ left: x, top: y }}
      data-testid="query-flow-node"
      onPointerDown={(event) => onNodePointerDown(event, node.id)}
      // Keyboard users get the same hover-driven affordances (enrichment fetch, editor highlight) on
      // focus, and Enter/Space selects the node the way a click does.
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={node.label}
      onFocus={() => {
        onRequestEnrichment?.(node.id);
        onNodeHover?.(node.id);
      }}
      onBlur={() => onNodeHover?.(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <QueryFlowNode
        node={node}
        height={height}
        enrichment={enrichment}
        onRequest={onRequestEnrichment ? () => onRequestEnrichment(node.id) : undefined}
        onHoverStart={onNodeHover ? () => onNodeHover(node.id) : undefined}
        onHoverEnd={onNodeHover ? () => onNodeHover(null) : undefined}
      />
    </div>
  );
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  }),
  viewport: css({
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: -2,
    },
  }),
  panning: css({
    cursor: 'grabbing',
  }),
  inner: css({
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: '0 0',
  }),
  node: css({
    position: 'absolute',
    cursor: 'grab',
    borderRadius: theme.shape.radius.default,
    '&:active': {
      cursor: 'grabbing',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: 2,
    },
  }),
  nodeSelected: css({
    outline: `2px solid ${theme.colors.primary.border}`,
    outlineOffset: 2,
  }),
  controls: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z1,
  }),
});
