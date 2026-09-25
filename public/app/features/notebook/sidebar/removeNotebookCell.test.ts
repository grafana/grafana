import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import { removeNotebookCell } from './removeNotebookCell';

function notebookSpec(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    elements: {
      first: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'First' } } } },
      second: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Second' } } } },
    },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'first' }, source: 'user' },
          },
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'second' }, source: 'user' },
          },
        ],
      },
    },
  };
}

describe('removeNotebookCell', () => {
  it('removes the layout item and its unreferenced element without changing the original spec', () => {
    const spec = notebookSpec();

    const updated = removeNotebookCell(spec, 'first');

    expect(updated.layout.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['second']);
    expect(updated.elements).toEqual({ second: spec.elements.second });
    expect(spec.layout.spec.cells).toHaveLength(2);
    expect(spec.elements.first).toBeDefined();
  });

  it('returns the original spec when the cell does not exist', () => {
    const spec = notebookSpec();

    expect(removeNotebookCell(spec, 'missing')).toBe(spec);
  });

  it('keeps an element that another layout item still references', () => {
    const spec = notebookSpec();
    spec.layout.spec.cells.push({
      kind: 'NotebookLayoutItem',
      spec: { element: { kind: 'ElementReference', name: 'first' }, source: 'user' },
    });

    const updated = removeNotebookCell(spec, 'first');

    expect(updated.layout.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['second', 'first']);
    expect(updated.elements.first).toBeDefined();
  });
});
