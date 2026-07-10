import { render } from '@testing-library/react';

import { type PositionedEdge } from '../layout';

import { QueryFlowEdges } from './QueryFlowEdges';

function edge(overrides: Partial<PositionedEdge> = {}): PositionedEdge {
  return {
    id: 'a->b',
    sourceId: 'a',
    targetId: 'b',
    source: { x: 100, y: 50 },
    target: { x: 200, y: 80 },
    ...overrides,
  };
}

describe('QueryFlowEdges', () => {
  it('renders the svg sized to width/height, hidden from the accessibility tree', () => {
    const { container } = render(<QueryFlowEdges edges={[]} width={400} height={300} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '400');
    expect(svg).toHaveAttribute('height', '300');
    expect(svg).toHaveAttribute('aria-hidden');
  });

  it('renders two paths (base + animated flow) per edge, drawn from target to source', () => {
    const { container } = render(<QueryFlowEdges edges={[edge()]} width={400} height={300} />);
    const paths = container.querySelectorAll('path');
    // +1 for the arrowhead marker's own path inside <defs>.
    expect(paths).toHaveLength(3);

    const [, base, flow] = Array.from(paths);
    // Curve starts at the child/target (right side, data source) and ends at the parent/source
    // (left side, result) so the marker-end arrowhead lands on the result — matching data flow.
    expect(base.getAttribute('d')).toMatch(/^M200,80 C/);
    expect(base.getAttribute('d')).toContain('100,50');
    expect(flow.getAttribute('d')).toBe(base.getAttribute('d'));
    expect(base).toHaveAttribute('marker-end');
  });

  it('renders one <g> group per edge, keyed by edge id', () => {
    const edges = [edge({ id: 'a->b' }), edge({ id: 'b->c', sourceId: 'b', targetId: 'c' })];
    const { container } = render(<QueryFlowEdges edges={edges} width={400} height={300} />);
    expect(container.querySelectorAll('g')).toHaveLength(2);
  });

  it('renders no edge groups when there are no edges', () => {
    const { container } = render(<QueryFlowEdges edges={[]} width={0} height={0} />);
    expect(container.querySelectorAll('g')).toHaveLength(0);
  });
});
