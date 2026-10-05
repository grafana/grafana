import { type Spec as NotebookSpec, defaultSpec as defaultNotebookSpec } from '../types';

import { appendNoteToNotebook } from './appendNoteToNotebook';

function notebook(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Investigation',
    elements: {
      note: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'First finding' } } } },
    },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'note' }, source: 'user' },
          },
        ],
      },
    },
  };
}

describe('appendNoteToNotebook', () => {
  it('appends a trimmed markdown note without changing the original spec', () => {
    const original = notebook();
    const result = appendNoteToNotebook(original, '  Second finding  ');

    expect(result).not.toBe(original);
    expect(original.elements).not.toHaveProperty('note-2');
    expect(result.elements['note-2']).toEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Markdown', spec: { text: 'Second finding' } } },
    });
    expect(result.layout.spec.cells.at(-1)).toEqual({
      kind: 'NotebookLayoutItem',
      spec: { element: { kind: 'ElementReference', name: 'note-2' }, source: 'user' },
    });
  });

  it('ignores an empty note', () => {
    const original = notebook();

    expect(appendNoteToNotebook(original, '   ')).toBe(original);
  });

  it('checks only own element names when finding the next name', () => {
    const original = notebook();
    original.elements = {};

    const result = appendNoteToNotebook(original, 'Constructor is not an element');

    expect(result.elements.note).toBeDefined();
  });
});
