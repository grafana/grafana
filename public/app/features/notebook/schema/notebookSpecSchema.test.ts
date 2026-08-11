import { defaultSpec as defaultNotebookSpec, type NotebookElement, type Spec as NotebookSpec } from '../types';

import { validateNotebookSpec } from './notebookSpecSchema';

function spec(overrides: Partial<NotebookSpec> = {}): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Notebook',
    tags: [],
    elements: {
      intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'hello' } } } },
    },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'assistant' },
          },
        ],
      },
    },
    ...overrides,
  };
}

const PANEL: NotebookElement = {
  kind: 'Panel',
  spec: {
    id: 1,
    title: 'p95',
    links: [],
    data: {
      kind: 'QueryGroup',
      spec: {
        queries: [],
        // Dashboard v2 transformation shape: the id lives in `group`, and the spec has no `id`.
        transformations: [{ kind: 'Transformation', group: 'limit', spec: { options: { limitField: 5 } } }],
        queryOptions: {},
      },
    },
    vizConfig: {
      kind: 'VizConfig',
      group: 'timeseries',
      version: '',
      spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
    },
  },
};

describe('validateNotebookSpec', () => {
  it('accepts a minimal notebook', () => {
    expect(validateNotebookSpec(spec())).toMatchObject({ success: true, errors: [], warnings: [] });
  });

  it('accepts markdown, code, panel and library panel elements', () => {
    const result = validateNotebookSpec(
      spec({
        elements: {
          md: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '# hi' } } } },
          code: { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language: 'promql', code: 'up' } } } },
          panel: PANEL,
          lib: { kind: 'LibraryPanel', spec: { id: 2, title: 'Shared', libraryPanel: { name: 'cpu', uid: 'lp-1' } } },
        },
        layout: {
          kind: 'NotebookLayout',
          spec: {
            cells: ['md', 'code', 'panel', 'lib'].map((name) => ({
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name }, source: 'user' },
            })),
          },
        },
      })
    );

    expect(result).toMatchObject({ success: true, errors: [] });
  });

  it('rejects the retired v2beta1 transformation shape', () => {
    // `{ kind: <id>, spec: { id: <id> } }` is what a notebook carried before its panel chain was
    // reparented onto the dashboard v2 shape. It is no longer describable, so it must not validate.
    // Written as a plain object because it is deliberately not a NotebookSpec, and validateNotebookSpec
    // takes `unknown`.
    const result = validateNotebookSpec({
      ...spec(),
      elements: {
        panel: {
          ...PANEL,
          spec: {
            ...PANEL.spec,
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [],
                transformations: [{ kind: 'limit', spec: { id: 'limit', options: {} } }],
                queryOptions: {},
              },
            },
          },
        },
      },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'panel' }, source: 'user' },
            },
          ],
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it('errors on a cell that references an element that is not there', () => {
    const result = validateNotebookSpec(
      spec({
        layout: {
          kind: 'NotebookLayout',
          spec: {
            cells: [
              {
                kind: 'NotebookLayoutItem',
                spec: { element: { kind: 'ElementReference', name: 'ghost' }, source: 'user' },
              },
            ],
          },
        },
      })
    );

    // Structurally valid and saves cleanly, but renders one cell short — the deserializer skips a
    // reference it cannot resolve. So this one is fatal.
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      'layout.spec.cells.0.spec.element.name: no element named "ghost" exists in elements',
    ]);
  });

  it('warns, but passes, on an element no cell references', () => {
    const result = validateNotebookSpec(
      spec({
        elements: {
          intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'hello' } } } },
          orphan: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'unused' } } } },
        },
      })
    );

    // An orphan costs the reader nothing, and it is what a spec looks like halfway through an edit
    // that removes a cell. Failing on it would make a read of someone else's notebook unvalidatable.
    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      'elements.orphan: not referenced by any cell in layout.spec.cells, so it will not render',
    ]);
  });

  it('normalizes Go nil collections and fills CUE defaults', () => {
    const result = validateNotebookSpec({
      title: 'Notebook',
      tags: null,
      elements: null,
      timeSettings: {},
      layout: { kind: 'NotebookLayout', spec: { cells: null } },
    });

    expect(result.success).toBe(true);
    expect(result.data?.tags).toEqual([]);
    expect(result.data?.elements).toEqual({});
    expect(result.data?.layout.spec.cells).toEqual([]);
    expect(result.data?.timeSettings).toMatchObject({ from: 'now-6h', to: 'now', timezone: 'browser' });
  });

  it('reports field-scoped messages a caller can act on', () => {
    const result = validateNotebookSpec({ title: 42, layout: { kind: 'GridLayout', spec: {} } });

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.startsWith('title:'))).toBe(true);
    expect(result.errors.some((e) => e.startsWith('layout.'))).toBe(true);
  });
});
