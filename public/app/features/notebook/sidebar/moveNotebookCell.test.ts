import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import { moveNotebookCell } from './moveNotebookCell';

function notebook(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: ['one', 'two', 'three'].map((name) => ({
          kind: 'NotebookLayoutItem' as const,
          spec: { element: { kind: 'ElementReference' as const, name }, source: 'user' as const },
        })),
      },
    },
  };
}

describe('moveNotebookCell', () => {
  it('moves a cell without changing the original spec', () => {
    const original = notebook();
    const result = moveNotebookCell(original, 'three', 0);

    expect(result.layout.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['three', 'one', 'two']);
    expect(original.layout.spec.cells.map((cell) => cell.spec.element.name)).toEqual(['one', 'two', 'three']);
  });

  it('returns the original spec when nothing moves', () => {
    const original = notebook();

    expect(moveNotebookCell(original, 'two', 1)).toBe(original);
    expect(moveNotebookCell(original, 'missing', 0)).toBe(original);
  });
});
