import {
  defaultLibraryPanelKind,
  defaultPanelKind,
  defaultSpec as defaultNotebookSpec,
  type LibraryPanelKind,
  type NotebookElement,
  type PanelKind,
  type Spec as NotebookSpec,
} from '../types';

import { appendPanelToNotebook } from './appendPanelToNotebook';

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

describe('appendPanelToNotebook', () => {
  it('appends the panel as the last cell, attributed to the user', () => {
    const spec = appendPanelToNotebook(notebook({ intro: panel('Intro') }), panel('p95 latency'));

    expect(elementNames(spec)).toEqual(['intro', 'p95-latency']);
    expect(spec.layout.spec.cells[1].spec.source).toBe('user');
    expect(spec.elements['p95-latency']).toMatchObject({ kind: 'Panel', spec: { title: 'p95 latency' } });
  });

  it('leaves the notebook it was given untouched', () => {
    const original = notebook({ intro: panel('Intro') });

    appendPanelToNotebook(original, panel('p95 latency'));

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
    const spec = appendPanelToNotebook(notebook(), panel(title));

    expect(elementNames(spec)).toEqual([expected]);
  });

  it('suffixes the name when the title collides with an existing element', () => {
    let spec = notebook({ 'p95-latency': panel('p95 latency') });

    spec = appendPanelToNotebook(spec, panel('p95 latency'));
    spec = appendPanelToNotebook(spec, panel('p95 latency'));

    expect(elementNames(spec)).toEqual(['p95-latency', 'p95-latency-2', 'p95-latency-3']);
  });

  // Slugs are lowercased, so `constructor` is the Object.prototype key a title can still land on.
  // With `name in elements` the empty notebook would report it as taken and this would be
  // `constructor-2`.
  it('does not treat the inherited key constructor as a collision', () => {
    const spec = appendPanelToNotebook(notebook(), panel('Constructor'));

    expect(elementNames(spec)).toEqual(['constructor']);
  });

  it('gives the panel an id above every id in use', () => {
    const spec = appendPanelToNotebook(notebook({ a: panel('A', 3), b: panel('B', 7) }), panel('C'));

    expect(spec.elements['c']).toMatchObject({ spec: { id: 8 } });
  });

  // A count-based id passes a contiguous fixture and collides here, which is how a notebook that
  // has had a cell deleted actually looks.
  it('skips ids freed by a deleted cell rather than reusing them', () => {
    const spec = appendPanelToNotebook(notebook({ a: panel('A', 1), c: panel('C', 3) }), panel('D'));

    expect(spec.elements['d']).toMatchObject({ spec: { id: 4 } });
  });

  it('counts library panel ids too, and keeps a library panel a library panel', () => {
    const spec = appendPanelToNotebook(notebook({ cpu: libraryPanel('CPU usage', 5) }), libraryPanel('Memory'));

    expect(spec.elements['memory']).toMatchObject({
      kind: 'LibraryPanel',
      spec: { id: 6, libraryPanel: { uid: 'lib-1' } },
    });
  });

  it('starts at 1 when the notebook holds no panels', () => {
    const spec = appendPanelToNotebook(notebook(), panel('First', 99));

    expect(spec.elements['first']).toMatchObject({ spec: { id: 1 } });
  });
});
