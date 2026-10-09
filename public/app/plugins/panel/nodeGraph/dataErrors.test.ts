import { formatGraphDataError } from './dataErrors';

describe('formatGraphDataError', () => {
  it.each([
    [1, 'Cannot visualize graph data: 1 edge references a missing node.'],
    [2, 'Cannot visualize graph data: 2 edges reference missing nodes.'],
  ])('should pluralize the affected edge count (%i)', (count, expected) => {
    const examples = Array.from({ length: count }, (_, rowIndex) => ({
      rowIndex,
      edgeId: `edge-${rowIndex}`,
      missing: [{ side: 'source' as const, id: `node-${rowIndex}` }],
    }));
    const message = formatGraphDataError({ kind: 'missing-endpoints', affectedEdges: count, examples });

    expect(message.startsWith(expected)).toBe(true);
    expect(message).toContain('Ensure every edge source and target has a matching node after transformations.');
  });

  it('should include the edge and both missing endpoints as text', () => {
    expect(
      formatGraphDataError({
        kind: 'missing-endpoints',
        affectedEdges: 1,
        examples: [
          {
            rowIndex: 0,
            edgeId: '<img src=x onerror=alert(1)>',
            missing: [
              { side: 'source', id: '<script>alert(1)</script>' },
              { side: 'target', id: 'target' },
            ],
          },
        ],
      })
    ).toBe(
      'Cannot visualize graph data: 1 edge references a missing node.\n' +
        'Edge “<img src=x onerror=alert(1)>”: source “<script>alert(1)</script>” is absent from the node data. ' +
        'target “target” is absent from the node data.\n' +
        'Ensure every edge source and target has a matching node after transformations.'
    );
  });

  it('should report how many affected edges were omitted from the bounded examples', () => {
    const examples = Array.from({ length: 5 }, (_, rowIndex) => ({
      rowIndex,
      edgeId: `edge-${rowIndex}`,
      missing: [{ side: 'source' as const, id: `node-${rowIndex}` }],
    }));

    expect(formatGraphDataError({ kind: 'missing-endpoints', affectedEdges: 7, examples })).toContain(
      '2 more affected edges not shown.'
    );
  });

  it('should name a missing required field without listing endpoint IDs', () => {
    expect(formatGraphDataError({ kind: 'missing-field', frame: 'edges', field: 'source' })).toBe(
      'Cannot visualize graph data: the source field is required in the edges data frame.'
    );
  });
});
