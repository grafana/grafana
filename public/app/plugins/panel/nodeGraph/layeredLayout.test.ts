import { layout } from './layeredLayout';

describe('layout', () => {
  it('can render single node', () => {
    const nodes = [{ id: 'A', incoming: 0 }];
    const edges: unknown[] = [];
    const graph = layout(nodes, edges);
    expect(graph).toEqual([[{ id: 'A', incoming: 0, x: 0, y: 0 }], []]);
  });
});
