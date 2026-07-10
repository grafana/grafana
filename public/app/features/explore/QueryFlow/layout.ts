import { hierarchy, tree } from 'd3-hierarchy';

import { type QueryFlowGraph, type QueryFlowNode } from './model/types';

export const NODE_WIDTH = 260;

// Vertical sizing of a node card, kept in sync with the CSS in QueryFlowNode so the layout reserves
// exactly the space each card occupies.
export const NODE_VERTICAL_PADDING = 16; // top + bottom padding
export const NODE_HEADER_HEIGHT = 24; // icon + title row
export const NODE_SUBLABEL_HEIGHT = 18; // optional secondary line under the title
// Divider block above the params list: 8px margin-top + 8px padding-top + 1px border (see `.params`
// in QueryFlowNode.tsx). Keep these in sync — a mismatch causes sibling nodes to visually overlap.
export const NODE_DIVIDER_HEIGHT = 17;
export const NODE_PARAM_ROW_HEIGHT = 22; // each attribute chip row
export const NODE_MAX_PARAM_ROWS = 8; // cap so very large selectors stay manageable
/** Fallback/minimum node height (header-only card). */
export const NODE_HEIGHT = NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT;

const LEVEL_GAP = 72; // horizontal gap between depth levels
const SIBLING_GAP = 28; // vertical gap between sibling rows
const PADDING = 16;

interface Point {
  x: number;
  y: number;
}

interface Box extends Point {
  height: number;
}

export interface PositionedNode {
  node: QueryFlowNode;
  /** Top-left corner of the node box. */
  x: number;
  y: number;
  /** Rendered height of the node card (varies with the number of attributes). */
  height: number;
}

export interface PositionedEdge {
  id: string;
  /** Parent (result-side) node id — endpoints can be recomputed when nodes are dragged. */
  sourceId: string;
  /** Child (source-side) node id. */
  targetId: string;
  /** Right-center of the parent (result-side) node. */
  source: Point;
  /** Left-center of the child (source-side) node. */
  target: Point;
}

export interface QueryFlowLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

const EMPTY_LAYOUT: QueryFlowLayout = { nodes: [], edges: [], width: 0, height: 0 };

/** Number of attribute rows a node renders (capped, with a "+N" summary row when truncated). */
export function visibleParamRows(node: QueryFlowNode): number {
  const count = node.params?.length ?? 0;
  if (count === 0) {
    return 0;
  }
  return Math.min(count, NODE_MAX_PARAM_ROWS);
}

/** Total rendered height of a node card, derived from its content. */
export function nodeHeight(node: QueryFlowNode): number {
  let height = NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT;
  if (node.sublabel) {
    height += NODE_SUBLABEL_HEIGHT;
  }
  const rows = visibleParamRows(node);
  if (rows > 0) {
    height += NODE_DIVIDER_HEIGHT + rows * NODE_PARAM_ROW_HEIGHT;
  }
  return height;
}

/**
 * Pixel endpoints for an edge given the two node boxes' top-left corners and heights: from the
 * parent's right-center (`source`) to the child's left-center (`target`).
 */
export function edgeEndpoints(parent: Box, child: Box): { source: Point; target: Point } {
  return {
    source: { x: parent.x + NODE_WIDTH, y: parent.y + parent.height / 2 },
    target: { x: child.x, y: child.y + child.height / 2 },
  };
}

/**
 * Lay the (tree-shaped) query graph out left-to-right with d3-hierarchy: the root (final result) on
 * the left, sources expanding to the right. Node heights vary with the number of attributes, so the
 * tree separation reserves room for each pair's half-heights. Coordinates are absolute pixel
 * top-left corners so the canvas can position plain HTML node cards over an SVG edge layer.
 */
export function layoutGraph(graph: QueryFlowGraph): QueryFlowLayout {
  const rootNode = graph.nodes[graph.rootId];
  if (!rootNode) {
    return EMPTY_LAYOUT;
  }

  // d3 lays out top-down (x = breadth, y = depth); we map depth → horizontal and breadth → vertical.
  // With a unit breadth step the separation function returns center-to-center distances in pixels,
  // letting us pack nodes of different heights without overlaps.
  const treeLayout = tree<QueryFlowNode>()
    .nodeSize([1, NODE_WIDTH + LEVEL_GAP])
    .separation((a, b) => nodeHeight(a.data) / 2 + nodeHeight(b.data) / 2 + SIBLING_GAP);

  const root = treeLayout(
    hierarchy<QueryFlowNode>(rootNode, (node) =>
      node.childIds.map((id) => graph.nodes[id]).filter((child): child is QueryFlowNode => Boolean(child))
    )
  );

  const points = root.descendants();
  // point.x is the breadth center; convert to a top-left corner accounting for each node's height.
  const minTop = Math.min(...points.map((p) => p.x - nodeHeight(p.data) / 2));
  const maxBottom = Math.max(...points.map((p) => p.x + nodeHeight(p.data) / 2));
  const maxDepth = Math.max(...points.map((p) => p.y));

  const boxOf = (point: { x: number; y: number; data: QueryFlowNode }): Box => ({
    x: point.y + PADDING,
    y: point.x - nodeHeight(point.data) / 2 - minTop + PADDING,
    height: nodeHeight(point.data),
  });

  const boxes = new Map<string, Box>();
  const nodes: PositionedNode[] = points.map((point) => {
    const box = boxOf(point);
    boxes.set(point.data.id, box);
    return { node: point.data, x: box.x, y: box.y, height: box.height };
  });

  const edges: PositionedEdge[] = root.links().map((link) => {
    const sourceId = link.source.data.id;
    const targetId = link.target.data.id;
    const { source, target } = edgeEndpoints(boxes.get(sourceId)!, boxes.get(targetId)!);
    return {
      id: `${sourceId}->${targetId}`,
      sourceId,
      targetId,
      source,
      target,
    };
  });

  return {
    nodes,
    edges,
    width: maxDepth + NODE_WIDTH + PADDING * 2,
    height: maxBottom - minTop + PADDING * 2,
  };
}
