import { notebookSpecSchema, validateNotebookSpec } from './notebookSpecSchema';

const timeSettings = {
  from: 'now-6h',
  to: 'now',
  autoRefresh: '',
  autoRefreshIntervals: ['5s'],
  hideTimepicker: false,
  fiscalYearStartMonth: 0,
  timezone: 'browser',
};

function markdownCell(text: string) {
  return { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text } } } };
}

function cellRef(name: string, source: 'assistant' | 'user' = 'assistant') {
  return { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name }, source } };
}

function panel(id: number, transformations: unknown[] = []) {
  return {
    kind: 'Panel',
    spec: {
      id,
      title: `Panel ${id}`,
      links: [],
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: [
            {
              kind: 'PanelQuery',
              spec: {
                refId: 'A',
                hidden: false,
                query: { kind: 'DataQuery', group: 'prometheus', version: 'v0', spec: { expr: 'up' } },
              },
            },
          ],
          transformations,
          queryOptions: {},
        },
      },
      vizConfig: {
        kind: 'VizConfig',
        group: 'timeseries',
        version: '1.0.0',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

function notebook(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Checkout latency investigation',
    tags: ['incident'],
    timeSettings,
    elements: { intro: markdownCell('## What we know') },
    layout: { kind: 'NotebookLayout', spec: { cells: [cellRef('intro')] } },
    ...overrides,
  };
}

describe('notebookSpecSchema', () => {
  it('accepts a narrative-only notebook', () => {
    expect(notebookSpecSchema.safeParse(notebook()).success).toBe(true);
  });

  it('accepts markdown, code and panel elements together', () => {
    const spec = notebook({
      elements: {
        intro: markdownCell('## What we know'),
        repro: { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language: 'promql', code: 'up' } } } },
        'panel-1': panel(1),
      },
      layout: {
        kind: 'NotebookLayout',
        spec: { cells: [cellRef('intro'), cellRef('repro', 'user'), cellRef('panel-1')] },
      },
    });

    expect(notebookSpecSchema.safeParse(spec).success).toBe(true);
  });

  it('rejects a dashboard layout, which a notebook cannot hold', () => {
    const spec = notebook({ layout: { kind: 'GridLayout', spec: { items: [] } } });

    const result = notebookSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown cell content kind', () => {
    const spec = notebook({
      elements: { intro: { kind: 'Cell', spec: { content: { kind: 'Mermaid', spec: { text: 'graph TD' } } } } },
    });

    expect(notebookSpecSchema.safeParse(spec).success).toBe(false);
  });

  it('requires a cell source, which is what carries assistant attribution', () => {
    const spec = notebook({
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [{ kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name: 'intro' } } }],
        },
      },
    });

    expect(notebookSpecSchema.safeParse(spec).success).toBe(false);
  });

  it('rejects a source outside assistant | user', () => {
    const spec = notebook({
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'bot' },
            },
          ],
        },
      },
    });

    expect(notebookSpecSchema.safeParse(spec).success).toBe(false);
  });

  it('normalizes Go nil slices to empty arrays', () => {
    const result = notebookSpecSchema.safeParse(
      notebook({ tags: null, layout: { kind: 'NotebookLayout', spec: { cells: null } }, elements: null })
    );

    expect(result.success).toBe(true);
    expect(result.data?.tags).toEqual([]);
    expect(result.data?.layout.spec.cells).toEqual([]);
    expect(result.data?.elements).toEqual({});
  });

  describe('panel transformations', () => {
    // A notebook is a v2beta1 resource: the transformation id lives in `kind` and is duplicated
    // in `spec.id`. Dashboard v2 (stable) moved it to `group` with no `spec.id`. Accepting the
    // wrong one here would let a scene round-trip persist a panel the resource cannot describe.
    it('accepts the v2beta1 transformation shape', () => {
      const spec = notebook({
        elements: {
          intro: markdownCell('x'),
          'panel-1': panel(1, [{ kind: 'organize', spec: { id: 'organize', options: { excludeByName: {} } } }]),
        },
        layout: { kind: 'NotebookLayout', spec: { cells: [cellRef('intro'), cellRef('panel-1')] } },
      });

      expect(notebookSpecSchema.safeParse(spec).success).toBe(true);
    });

    it('rejects the dashboard v2 transformation shape', () => {
      const spec = notebook({
        elements: {
          intro: markdownCell('x'),
          'panel-1': panel(1, [{ kind: 'Transformation', group: 'organize', spec: { options: {} } }]),
        },
        layout: { kind: 'NotebookLayout', spec: { cells: [cellRef('intro'), cellRef('panel-1')] } },
      });

      expect(notebookSpecSchema.safeParse(spec).success).toBe(false);
    });
  });
});

describe('validateNotebookSpec', () => {
  it('returns the parsed spec on success', () => {
    const result = validateNotebookSpec(notebook());

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.title).toBe('Checkout latency investigation');
  });

  it('reports structural errors with a field path', () => {
    const result = validateNotebookSpec(notebook({ title: 42 }));

    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('title:');
  });

  // The malformation that motivated this validator: a layout that references an element which is
  // not in `elements` is structurally valid, saves cleanly, and renders as a missing cell.
  it('reports a cell that references a missing element', () => {
    const result = validateNotebookSpec(
      notebook({ layout: { kind: 'NotebookLayout', spec: { cells: [cellRef('intro'), cellRef('ghost')] } } })
    );

    expect(result.success).toBe(false);
    expect(result.errors).toEqual([
      'layout.spec.cells.1.spec.element.name: no element named "ghost" exists in elements',
    ]);
  });

  // A warning, not an error, and the spec still comes back. An orphan costs the reader nothing, it is
  // what a spec looks like halfway through an edit that removes a cell, and failing on it would mean
  // a notebook someone else saved could not be read with `validate: true` at all.
  it('warns about an element no cell references, and still returns the spec', () => {
    const result = validateNotebookSpec(
      notebook({ elements: { intro: markdownCell('a'), orphan: markdownCell('b') } })
    );

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      'elements.orphan: not referenced by any cell in layout.spec.cells, so it will not render',
    ]);
    expect(result.data).toBeDefined();
  });

  it('does not run referential checks when the spec is structurally invalid', () => {
    const result = validateNotebookSpec({ title: 'no layout' });

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('not referenced by any cell'))).toBe(false);
  });
});
