import { equalizeAtDivider, moveDivider } from './dividers';
import { closeView, detachPanel, detachView, hidePanel, restorePanel } from './document';
import { applyDrop } from './drop';
import { findDropTarget, type FindDropTargetInput } from './findDropTarget';
import { computeZoomedGeometry, computeGeometry, distributeByWeight } from './geometry';
import { findPanelOfView } from './locate';
import { createTilingDocument, tilingLayout as L } from './spec';
import { findNode, findParentSplit, insertAtLayoutEdge, insertBesideNode, normalizeTree } from './tree';
import { type LayoutDocument, type LayoutMetrics, type LayoutNode, type PanelNode, type SplitNode } from './types';

const metrics: LayoutMetrics = { gap: 6, tabBarHeight: 32, minPanelWidth: 80, minPanelHeight: 56 };
const viewport = { x: 0, y: 0, w: 1206, h: 806 };
const bounds = { x: 6, y: 6, w: 1194, h: 794 };

function panel(id: string, views = [id]): PanelNode {
  return { kind: 'panel', id, views, selected: views[0] };
}

function split(id: string, axis: 'x' | 'y', children: LayoutNode[], weights = children.map(() => 1)): SplitNode {
  return { kind: 'split', id, axis, children, weights };
}

function shares(node: LayoutNode | undefined | null): number[] {
  if (!node || node.kind !== 'split') {
    throw new Error('expected split');
  }
  const total = node.weights.reduce((a, b) => a + b, 0);
  return node.weights.map((w) => Math.round((w / total) * 1000) / 1000);
}

function threeColumns(): LayoutDocument {
  return createTilingDocument(
    L.row(
      [L.panel({ id: 'a' }, L.view('va')), L.panel({ id: 'b' }, L.view('vb')), L.panel({ id: 'c' }, L.view('vc'))],
      [1, 2, 1],
      'root'
    )
  );
}

describe('tree normalization', () => {
  it('collapses single-child splits and flattens nested splits on the same axis', () => {
    const tree = split(
      'r',
      'x',
      [panel('a'), split('inner', 'x', [panel('b'), panel('c')], [1, 3]), split('lonely', 'y', [panel('d')])],
      [2, 2, 1]
    );
    const result = normalizeTree(tree) as SplitNode;
    expect(result.children.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(shares(result)).toEqual([0.4, 0.1, 0.3, 0.2]);
  });

  it('hands the space of a removed child to its next neighbour', () => {
    const doc = threeColumns();
    const next = detachPanel(doc, 'b');
    expect(shares(next.root)).toEqual([0.25, 0.75]);
    expect((next.root as SplitNode).children.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('hands the space to the previous neighbour when the last child is removed', () => {
    const next = detachPanel(threeColumns(), 'c');
    expect(shares(next.root)).toEqual([0.25, 0.75]);
  });
});

describe('inserting', () => {
  it('splits a panel in half when its parent runs along the other axis', () => {
    const root = split('r', 'y', [panel('a'), panel('b')]);
    const result = insertBesideNode(root, 'b', 'right', panel('n')) as SplitNode;
    const inner = result.children[1] as SplitNode;
    expect(inner.axis).toBe('x');
    expect(inner.children.map((c) => c.id)).toEqual(['b', 'n']);
    expect(shares(inner)).toEqual([0.5, 0.5]);
  });

  it('inserts into a same-axis parent with a 1/(n+1) share, keeping the other ratios', () => {
    const root = split('r', 'x', [panel('a'), panel('b')], [3, 1]);
    const result = insertBesideNode(root, 'a', 'right', panel('n')) as SplitNode;
    expect(result.children.map((c) => c.id)).toEqual(['a', 'n', 'b']);
    expect(shares(result)).toEqual([0.5, 0.333, 0.167]);
  });

  it('wraps the root in a new split for an edge on the other axis', () => {
    const root = split('r', 'y', [panel('a'), panel('b')]);
    const result = insertAtLayoutEdge(root, 'left', panel('n')) as SplitNode;
    expect(result.axis).toBe('x');
    expect(result.children.map((c) => c.id)).toEqual(['n', 'r']);
  });
});

describe('applyDrop', () => {
  it('drops into a divider between siblings', () => {
    const doc = threeColumns();
    const result = applyDrop(doc, panel('n'), {
      kind: 'divider',
      splitId: 'root',
      axis: 'x',
      prevId: 'a',
      nextId: 'b',
    });
    expect((result.root as SplitNode).children.map((c) => c.id)).toEqual(['a', 'n', 'b', 'c']);
  });

  it('resolves a divider next to the removed source', () => {
    const doc = createTilingDocument(
      L.row(
        [
          L.panel({ id: 'a' }, L.view('va')),
          L.column([L.panel({ id: 's' }, L.view('vs')), L.panel({ id: 'b' }, L.view('vb'))], undefined, 'col'),
        ],
        undefined,
        'root'
      )
    );
    const base = detachPanel(doc, 's');
    // The column collapsed into b, so the divider between s and b becomes "above b".
    const result = applyDrop(base, panel('s'), {
      kind: 'divider',
      splitId: 'col',
      axis: 'y',
      prevId: 's',
      nextId: 'b',
    });
    const col = findParentSplit(result.root, 'b')!.parent;
    expect(col.axis).toBe('y');
    expect(col.children.map((c) => c.id)).toEqual(['s', 'b']);
  });

  it('adds views as tabs at an index and selects the dropped view', () => {
    const doc = createTilingDocument(
      L.row([L.panel({ id: 'a' }, L.view('v1'), L.view('v2')), L.panel({ id: 'b' }, L.view('v3'))])
    );
    const base = detachPanel(doc, 'b');
    const result = applyDrop(base, panel('b', ['v3']), { kind: 'tab', panelId: 'a', index: 1 });
    expect(result.root).toEqual({ kind: 'panel', id: 'a', views: ['v1', 'v3', 'v2'], selected: 'v3' });
  });
});

describe('layout', () => {
  it('keeps every child at its minimum, taking space from children with room first', () => {
    expect(distributeByWeight(300, [1, 1, 10], [80, 80, 80])).toEqual([80, 80, 140]);
  });

  it('lays out children by weight with gaps between them', () => {
    const layout = computeGeometry(threeColumns().root, bounds, metrics);
    const [a, b, c] = ['a', 'b', 'c'].map((id) => layout.rects.get(id)!);
    expect(a.x).toBe(6);
    expect(b.x).toBe(a.x + a.w + 6);
    expect(c.x + c.w).toBe(1200);
    expect(b.w).toBeCloseTo(a.w * 2, -1);
    expect(layout.dividers).toHaveLength(2);
    expect(layout.dividers[0].rect).toEqual({ x: a.x + a.w, y: 6, w: 6, h: 794 });
  });

  it('frames a node so it fills the bounds', () => {
    const layout = computeZoomedGeometry(threeColumns().root, bounds, metrics, 'b');
    expect(layout.rects.get('b')).toEqual(bounds);
    expect(layout.rects.get('a')!.x + layout.rects.get('a')!.w).toBeLessThanOrEqual(0);
    expect(layout.rects.get('c')!.x).toBeGreaterThanOrEqual(1206);
  });
});

describe('resizeSplit', () => {
  it('only changes the two neighbours while there is room', () => {
    const doc = threeColumns();
    const layout = computeGeometry(doc.root, bounds, metrics);
    const before = ['a', 'b', 'c'].map((id) => layout.rects.get(id)!.w);
    const root = moveDivider(doc.root!, layout, metrics, 'root', 0, 50);
    const after = computeGeometry(root, bounds, metrics);
    expect(['a', 'b', 'c'].map((id) => after.rects.get(id)!.w)).toEqual([before[0] + 50, before[1] - 50, before[2]]);
  });

  it('pushes the next divider once a neighbour reaches its minimum', () => {
    const doc = threeColumns();
    const layout = computeGeometry(doc.root, bounds, metrics);
    const root = moveDivider(doc.root!, layout, metrics, 'root', 0, 2000);
    const after = computeGeometry(root, bounds, metrics);
    expect(after.rects.get('b')!.w).toBe(80);
    expect(after.rects.get('c')!.w).toBe(80);
  });

  it("pushes the split's own edge into the panels around it", () => {
    // row [ column [ row [x, y], z ], w ]
    const root = split('r', 'x', [
      split('col', 'y', [split('inner', 'x', [panel('x'), panel('y')]), panel('z')]),
      panel('w'),
    ]);
    const layout = computeGeometry(root, bounds, metrics);
    const wBefore = layout.rects.get('w')!.w;
    const yBefore = layout.rects.get('y')!.w;
    const xBefore = layout.rects.get('x')!.w;
    const delta = yBefore - 80 + 100;
    const next = moveDivider(root, layout, metrics, 'inner', 0, delta);
    const after = computeGeometry(next, bounds, metrics);
    expect(after.rects.get('y')!.w).toBe(80);
    expect(after.rects.get('w')!.w).toBe(wBefore - 100);
    expect(after.rects.get('x')!.w).toBe(xBefore + delta);
  });

  it('evens out two neighbours', () => {
    const root = equalizeAtDivider(threeColumns().root!, 'root', 0);
    expect(shares(root)).toEqual([0.375, 0.375, 0.25]);
  });
});

describe('hide and restore', () => {
  it('returns a docked panel beside the neighbour that absorbed its space, at the same share', () => {
    const doc = threeColumns();
    const hidden = hidePanel(doc, 'b');
    expect(hidden.hidden).toHaveLength(1);
    expect(findNode(hidden.root, 'b')).toBeUndefined();
    const restored = restorePanel(hidden, 'b');
    expect((restored.root as SplitNode).children.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(shares(restored.root)).toEqual([0.25, 0.5, 0.25]);
  });

  it('hides a single tab and puts it back into its panel', () => {
    const doc = createTilingDocument(L.panel({ id: 'p' }, L.view('v1'), L.view('v2'), L.view('v3')));
    const hidden = hidePanel(doc, 'v2');
    expect((hidden.root as PanelNode).views).toEqual(['v1', 'v3']);
    const restored = restorePanel(hidden, hidden.hidden[0].panel.id);
    expect((restored.root as PanelNode).views).toEqual(['v1', 'v2', 'v3']);
  });

  it('floats a panel whose neighbour is gone', () => {
    const hidden = closeView(hidePanel(threeColumns(), 'b'), 'vc');
    const restored = restorePanel(hidden, 'b');
    expect(restored.floating.map((f) => f.panel.id)).toEqual(['b']);
  });
});

describe('closing', () => {
  it('selects the neighbouring tab when the selected one closes', () => {
    const doc = createTilingDocument(L.panel({ id: 'p', selected: 1 }, L.view('v1'), L.view('v2'), L.view('v3')));
    const next = closeView(doc, 'v2');
    expect(next.root).toEqual({ kind: 'panel', id: 'p', views: ['v1', 'v3'], selected: 'v3' });
    expect(next.views.v2).toBeUndefined();
  });

  it('keeps the record when a view is only detached', () => {
    const doc = threeColumns();
    const next = detachView(doc, 'vb');
    expect(next.views.vb).toBeDefined();
    expect(findPanelOfView(next, 'vb')).toBeUndefined();
  });
});

describe('hitTest', () => {
  const doc = threeColumns();
  const layout = computeGeometry(doc.root, bounds, metrics);
  const input = (x: number, y: number, extra: Partial<FindDropTargetInput> = {}): FindDropTargetInput => ({
    point: { x, y },
    viewport,
    doc,
    layout,
    floating: [],
    metrics,
    tabIndexAt: () => 0,
    ...extra,
  });
  const b = layout.rects.get('b')!;

  it('targets the tab bar, edges and centre of a panel', () => {
    expect(findDropTarget(input(b.x + b.w / 2, b.y + 10))).toEqual({ kind: 'tab', panelId: 'b', index: 0 });
    expect(findDropTarget(input(b.x + 10, b.y + b.h / 2))).toEqual({ kind: 'panel-edge', panelId: 'b', side: 'left' });
    expect(findDropTarget(input(b.x + b.w / 2, b.y + b.h - 10))).toEqual({
      kind: 'panel-edge',
      panelId: 'b',
      side: 'bottom',
    });
    expect(findDropTarget(input(b.x + b.w / 2, b.y + b.h / 2))).toEqual({ kind: 'tab', panelId: 'b', index: 1 });
  });

  it('prefers dividers over panel edges', () => {
    expect(findDropTarget(input(b.x - 3, 300))).toEqual({
      kind: 'divider',
      splitId: 'root',
      axis: 'x',
      prevId: 'a',
      nextId: 'b',
    });
  });

  it('targets the outer frame band', () => {
    expect(findDropTarget(input(1203, 300))).toEqual({ kind: 'layout-edge', side: 'right' });
  });

  it('reports self while over the dragged panel', () => {
    expect(findDropTarget(input(b.x + b.w / 2, b.y + b.h / 2, { selfPanelId: 'b' }))).toBe('self');
  });

  it('lets a moving float pass over panel centres', () => {
    expect(findDropTarget(input(b.x + b.w / 2, b.y + b.h / 2, { movingFloatId: 'f' }))).toBeNull();
    expect(findDropTarget(input(b.x + b.w * 0.2, b.y + b.h / 2, { movingFloatId: 'f' }))).toBeNull();
    expect(findDropTarget(input(b.x + b.w * 0.1, b.y + b.h / 2, { movingFloatId: 'f' }))).toEqual({
      kind: 'panel-edge',
      panelId: 'b',
      side: 'left',
    });
  });
});
