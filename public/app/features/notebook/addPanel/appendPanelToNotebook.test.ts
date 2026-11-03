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

/** Minted names are `<base>-<6 random chars>`, so a test can only pin the base. */
function named(base: string) {
  return expect.stringMatching(new RegExp(`^${base}-[a-z0-9]{6}$`));
}

function lastName(spec: NotebookSpec): string {
  return elementNames(spec).at(-1)!;
}

describe('appendElementsToNotebook with one panel', () => {
  it('appends the panel as the last cell, attributed to the user', () => {
    const spec = appendElementsToNotebook(notebook({ intro: panel('Intro') }), [
      { kind: 'panel', panel: panel('p95 latency') },
    ]);

    expect(elementNames(spec)).toEqual(['intro', named('p95-latency')]);
    expect(spec.layout.spec.cells[1].spec.source).toBe('user');
    expect(spec.elements[lastName(spec)]).toMatchObject({ kind: 'Panel', spec: { title: 'p95 latency' } });
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

    expect(elementNames(spec)).toEqual([named(expected)]);
  });

  it('mints a distinct name for each panel with the same title', () => {
    let spec = notebook();

    spec = appendElementsToNotebook(spec, [{ kind: 'panel', panel: panel('p95 latency') }]);
    spec = appendElementsToNotebook(spec, [{ kind: 'panel', panel: panel('p95 latency') }]);
    spec = appendElementsToNotebook(spec, [{ kind: 'panel', panel: panel('p95 latency') }]);

    expect(new Set(elementNames(spec)).size).toBe(3);
  });

  // The reason names are random: a counter hands a deleted cell's name to the next cell added, which
  // would attach the deleted cell's comments to it.
  it('does not reissue the name of a deleted cell', () => {
    let spec = appendElementsToNotebook(notebook(), [{ kind: 'panel', panel: panel('p95 latency') }]);
    const deleted = lastName(spec);
    spec = { ...spec, elements: {}, layout: { ...spec.layout, spec: { cells: [] } } };

    spec = appendElementsToNotebook(spec, [{ kind: 'panel', panel: panel('p95 latency') }]);

    expect(lastName(spec)).not.toBe(deleted);
  });

  // Slugs are lowercased, so `constructor` is the Object.prototype key a title can still land on.
  // With `name in elements` it would be reported as taken; minted names carry a suffix, so an
  // inherited key can't be hit, but the base must still come through.
  it('keeps a title that matches an inherited Object.prototype key as the base', () => {
    const spec = appendElementsToNotebook(notebook(), [{ kind: 'panel', panel: panel('Constructor') }]);

    expect(elementNames(spec)).toEqual([named('constructor')]);
  });

  it('gives the panel an id above every id in use', () => {
    const spec = appendElementsToNotebook(notebook({ a: panel('A', 3), b: panel('B', 7) }), [
      { kind: 'panel', panel: panel('C') },
    ]);

    expect(spec.elements[lastName(spec)]).toMatchObject({ spec: { id: 8 } });
  });

  // A count-based id passes a contiguous fixture and collides here, which is how a notebook that
  // has had a cell deleted actually looks.
  it('skips ids freed by a deleted cell rather than reusing them', () => {
    const spec = appendElementsToNotebook(notebook({ a: panel('A', 1), c: panel('C', 3) }), [
      { kind: 'panel', panel: panel('D') },
    ]);

    expect(spec.elements[lastName(spec)]).toMatchObject({ spec: { id: 4 } });
  });

  it('counts library panel ids too, and keeps a library panel a library panel', () => {
    const spec = appendElementsToNotebook(notebook({ cpu: libraryPanel('CPU usage', 5) }), [
      { kind: 'panel', panel: libraryPanel('Memory') },
    ]);

    expect(spec.elements[lastName(spec)]).toMatchObject({
      kind: 'LibraryPanel',
      spec: { id: 6, libraryPanel: { uid: 'lib-1' } },
    });
  });

  it('starts at 1 when the notebook holds no panels', () => {
    const spec = appendElementsToNotebook(notebook(), [{ kind: 'panel', panel: panel('First', 99) }]);

    expect(spec.elements[lastName(spec)]).toMatchObject({ spec: { id: 1 } });
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

    const names = elementNames(spec);
    expect(names).toEqual(['intro', named('markdown'), named('p95-latency'), named('p95-latency'), named('markdown')]);
    expect(new Set(names).size).toBe(5);
    const ids = [names[2], names[3]].map((name) => {
      const element = spec.elements[name];
      return element.kind === 'Panel' ? element.spec.id : undefined;
    });
    expect(ids).toEqual([5, 6]);
    expect(spec.elements[names[1]]).toEqual({
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
