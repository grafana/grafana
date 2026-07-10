import {
  layoutGraph,
  nodeHeight,
  NODE_DIVIDER_HEIGHT,
  NODE_HEADER_HEIGHT,
  NODE_PARAM_ROW_HEIGHT,
  NODE_SUBLABEL_HEIGHT,
  NODE_VERTICAL_PADDING,
} from './layout';
import { promqlMapper } from './model/languages/promql';
import { type QueryFlowNode, QueryFlowNodeKind } from './model/types';

function rectsOverlap(
  a: { x: number; y: number; height: number },
  b: { x: number; y: number; height: number },
  width: number
) {
  const xOverlap = a.x < b.x + width && b.x < a.x + width;
  const yOverlap = a.y < b.y + b.height && b.y < a.y + a.height;
  return xOverlap && yOverlap;
}

function makeNode(overrides: Partial<QueryFlowNode>): QueryFlowNode {
  return {
    id: 'n',
    kind: QueryFlowNodeKind.Selector,
    language: 'promql',
    label: 'n',
    span: { from: 0, to: 1 },
    childIds: [],
    ...overrides,
  };
}

describe('layoutGraph', () => {
  it('positions the root on the left with children to its right and no overlaps', () => {
    const graph = promqlMapper.buildGraph('sum by (le) (rate(metric{job="api"}[5m]))');
    const layout = layoutGraph(graph);

    expect(layout.nodes.length).toBe(Object.keys(graph.nodes).length);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);

    const byId = new Map(layout.nodes.map((n) => [n.node.id, n]));

    // Every edge flows left-to-right (parent on the left, child on the right) and carries the
    // node ids so the canvas can recompute endpoints when nodes are dragged.
    for (const edge of layout.edges) {
      expect(edge.target.x).toBeGreaterThanOrEqual(edge.source.x);
      expect(byId.has(edge.sourceId)).toBe(true);
      expect(byId.has(edge.targetId)).toBe(true);
    }

    // The root (final result) sits at the left edge.
    const rootPos = byId.get(graph.rootId)!;
    const minX = Math.min(...layout.nodes.map((n) => n.x));
    expect(rootPos.x).toBe(minX);

    // No two nodes share the same position.
    const positions = new Set(layout.nodes.map((n) => `${n.x},${n.y}`));
    expect(positions.size).toBe(layout.nodes.length);
  });

  it('returns an empty layout for an empty graph', () => {
    const layout = layoutGraph(promqlMapper.buildGraph(''));
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
  });

  it('does not let sibling node boxes overlap when heights differ (many-vs-few params)', () => {
    // Two aggregations with very different matcher counts as siblings of a binary op — a reserved
    // height smaller than the rendered card (see NODE_DIVIDER_HEIGHT regression) causes overlap here.
    const graph = promqlMapper.buildGraph(
      'sum(metric_a{env="prod",job="api",instance="1",region="us",az="a"}) + sum(metric_b{env="prod"})'
    );
    const layout = layoutGraph(graph);

    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        expect(rectsOverlap(layout.nodes[i], layout.nodes[j], 260)).toBe(false);
      }
    }
  });
});

describe('nodeHeight', () => {
  // Locks in the height formula against the constants derived from QueryFlowNode.tsx's CSS
  // (header padding, sublabel row, params divider + rows). If this test needs updating, first
  // check whether `.card`/`.sublabel`/`.params`/`.param` in components/QueryFlowNode.tsx changed —
  // the constants in layout.ts must stay in sync with the actual rendered card.
  it('is header + padding only for a node with no sublabel or params', () => {
    const node = makeNode({});
    expect(nodeHeight(node)).toBe(NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT);
  });

  it('adds the sublabel row height when a sublabel is present', () => {
    const node = makeNode({ sublabel: 'by (job)' });
    expect(nodeHeight(node)).toBe(NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT + NODE_SUBLABEL_HEIGHT);
  });

  it('adds the divider plus one row height per param', () => {
    const node = makeNode({ params: [{ value: 'job="api"' }, { value: 'env="prod"' }] });
    expect(nodeHeight(node)).toBe(
      NODE_VERTICAL_PADDING + NODE_HEADER_HEIGHT + NODE_DIVIDER_HEIGHT + 2 * NODE_PARAM_ROW_HEIGHT
    );
  });
});
