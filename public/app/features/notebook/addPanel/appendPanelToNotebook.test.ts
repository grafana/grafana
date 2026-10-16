import {
  defaultLibraryPanelKind,
  defaultPanelKind,
  defaultSpec as defaultNotebookSpec,
  type LibraryPanelKind,
  type NotebookElement,
  type PanelKind,
  type Spec as NotebookSpec,
} from '../types';

import { appendElementsToNotebook } from './appendPanelToNotebook';

function panel(title: string, id = 1): PanelKind {
  const base = defaultPanelKind();
  return { ...base, spec: { ...base.spec, id, title } };
}

function libraryPanel(title: string, id = 1): LibraryPanelKind {
  const base = defaultLibraryPanelKind();
  return { ...base, spec: { ...base.spec, id, title, libraryPanel: { uid: 'lib-1', name: title } } };
}

function notebook(elements: Record<string, NotebookElement> = {}): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    elements,
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: Object.keys(elements).map((name) => ({
          kind: 'NotebookLayoutItem' as const,
          spec: { element: { kind: 'ElementReference' as const, name }, source: 'assistant' as const },
        })),
      },
    },
  };
}

function elementNames(spec: NotebookSpec): string[] {
  return spec.layout.spec.cells.map((cell) => cell.spec.element.name);
}

describe('appendElementsToNotebook with one panel', () => {
  it('appends the panel as the last cell, attributed to the user', () => {
    const spec = appendElementsToNotebook(notebook({ intro: panel('Intro') }), [
      { kind: 'panel', panel: panel('p95 latency') },
    ]);

    expect(elementNames(spec)).toEqual(['intro', 'p95-latency']);
    expect(spec.layout.spec.cells[1].spec.source).toBe('user');
    expect(spec.elements['p95-latency']).toMatchObject({ kind: 'Panel', spec: { title: 'p95 latency' } });
  });

  it('leaves the notebook it was given untouched', () => {
    const original = notebook({ intro: panel('Intro') });

    appendElementsToNotebook(original, [{ kind: 'panel', panel: panel('p95 latency') }]);

    expect(Object.keys(original.elements)).toEqual(['intro']);
    expect(original.layout.spec.cells).toHaveLength(1);
  });

  it.each([
    ['p95 latency', 'p95-latency'],
    ['  Checkout / errors!  ', 'checkout-errors'],
    ['', 'panel'],
    // Slugifies to nothing rather than to a name that is only separators.
    ['日本語', 'panel'],
  ])('derives the element name from the title (%s)', (title, expected) => {
    const spec = appendElementsToNotebook(notebook(), [{ kind: 'panel', panel: panel(title) }]);

    expect(elementNames(spec)).toEqual([expected]);
  });

  it('suffixes the name when the title collides with an existing element', () => {
    let spec = notebook({ 'p95-latency': panel('p95 latency') });

    spec = appendElementsToNotebook(spec, [{ kind: 'panel', panel: panel('p95 latency') }]);
    spec = appendElementsToNotebook(spec, [{ kind: 'panel', panel: panel('p95 latency') }]);

    expect(elementNames(spec)).toEqual(['p95-latency', 'p95-latency-2', 'p95-latency-3']);
  });

  // Slugs are lowercased, so `constructor` is the Object.prototype key a title can still land on.
  // With `name in elements` the empty notebook would report it as taken and this would be
  // `constructor-2`.
  it('does not treat the inherited key constructor as a collision', () => {
    const spec = appendElementsToNotebook(notebook(), [{ kind: 'panel', panel: panel('Constructor') }]);

    expect(elementNames(spec)).toEqual(['constructor']);
  });

  it('gives the panel an id above every id in use', () => {
    const spec = appendElementsToNotebook(notebook({ a: panel('A', 3), b: panel('B', 7) }), [
      { kind: 'panel', panel: panel('C') },
    ]);

    expect(spec.elements['c']).toMatchObject({ spec: { id: 8 } });
  });

  // A count-based id passes a contiguous fixture and collides here, which is how a notebook that
  // has had a cell deleted actually looks.
  it('skips ids freed by a deleted cell rather than reusing them', () => {
    const spec = appendElementsToNotebook(notebook({ a: panel('A', 1), c: panel('C', 3) }), [
      { kind: 'panel', panel: panel('D') },
    ]);

    expect(spec.elements['d']).toMatchObject({ spec: { id: 4 } });
  });

  it('counts library panel ids too, and keeps a library panel a library panel', () => {
    const spec = appendElementsToNotebook(notebook({ cpu: libraryPanel('CPU usage', 5) }), [
      { kind: 'panel', panel: libraryPanel('Memory') },
    ]);

    expect(spec.elements['memory']).toMatchObject({
      kind: 'LibraryPanel',
      spec: { id: 6, libraryPanel: { uid: 'lib-1' } },
    });
  });

  it('starts at 1 when the notebook holds no panels', () => {
    const spec = appendElementsToNotebook(notebook(), [{ kind: 'panel', panel: panel('First', 99) }]);

    expect(spec.elements['first']).toMatchObject({ spec: { id: 1 } });
  });
});

describe('appendElementsToNotebook', () => {
  it('appends mixed cells in order with names and ids unique across the batch', () => {
    const spec = appendElementsToNotebook(
      notebook({ intro: panel('Intro', 4) }),
      [
        { kind: 'markdown', text: 'Latency rose after the deploy.' },
        { kind: 'panel', panel: panel('p95 latency') },
        { kind: 'panel', panel: panel('p95 latency') },
        { kind: 'markdown', text: 'It recovered.' },
      ],
      'assistant'
    );

    expect(elementNames(spec)).toEqual(['intro', 'markdown', 'p95-latency', 'p95-latency-2', 'markdown-2']);
    const ids = ['p95-latency', 'p95-latency-2'].map((name) => {
      const element = spec.elements[name];
      return element.kind === 'Panel' ? element.spec.id : undefined;
    });
    expect(ids).toEqual([5, 6]);
    expect(spec.elements.markdown).toEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Markdown', spec: { text: 'Latency rose after the deploy.' } } },
    });
    expect(spec.layout.spec.cells.slice(1).map((cell) => cell.spec.source)).toEqual([
      'assistant',
      'assistant',
      'assistant',
      'assistant',
    ]);
  });

  it('attributes cells to the user by default', () => {
    const spec = appendElementsToNotebook(notebook(), [{ kind: 'markdown', text: 'Note' }]);

    expect(spec.layout.spec.cells.map((cell) => cell.spec.source)).toEqual(['user']);
  });
});
