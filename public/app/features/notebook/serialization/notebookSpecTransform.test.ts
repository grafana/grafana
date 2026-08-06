import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';

import { notebookSpecSchema } from '../schema/notebookSpecSchema';

import {
  dashboardSpecToNotebookSpec,
  isNotebookScene,
  notebookSpecToDashboardSpec,
  setNotebookDocumentHeader,
} from './notebookSpecTransform';

const timeSettings = {
  from: 'now-3h',
  to: 'now',
  autoRefresh: '',
  autoRefreshIntervals: ['5s'],
  hideTimepicker: false,
  fiscalYearStartMonth: 0,
  timezone: 'browser',
};

function panelWithTransformations(transformations: unknown[]) {
  return {
    kind: 'Panel',
    spec: {
      id: 1,
      title: 'Errors',
      links: [],
      data: { kind: 'QueryGroup', spec: { queries: [], transformations, queryOptions: {} } },
      vizConfig: {
        kind: 'VizConfig',
        group: 'timeseries',
        version: '1.0.0',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
    },
  };
}

function makeNotebook(overrides: Partial<NotebookSpec> = {}): NotebookSpec {
  const spec = {
    title: 'Checkout latency',
    tags: ['incident'],
    timeSettings,
    elements: {
      intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '## What we know' } } } },
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

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture matching the generated spec
  return spec as unknown as NotebookSpec;
}

describe('notebookSpecToDashboardSpec', () => {
  it('overlays the notebook fields on the dashboard defaults so the transformer finds every field', () => {
    const dashboard = notebookSpecToDashboardSpec(makeNotebook());

    expect(dashboard.title).toBe('Checkout latency');
    expect(dashboard.tags).toEqual(['incident']);
    expect(dashboard.timeSettings.from).toBe('now-3h');
    // Dashboard-only fields the scene transformer reads unguarded must be present.
    expect(dashboard.variables).toEqual([]);
    expect(dashboard.annotations).toEqual([]);
    expect(dashboard.links).toEqual([]);
    expect(dashboard.cursorSync).toBeDefined();
    expect(dashboard.editable).toBeDefined();
    expect(dashboard.preload).toBeDefined();
  });

  it('substitutes an empty description rather than writing undefined over the default', () => {
    expect(notebookSpecToDashboardSpec(makeNotebook()).description).toBe('');
  });

  it('carries the notebook layout and elements through untouched', () => {
    const dashboard = notebookSpecToDashboardSpec(makeNotebook());

    expect(dashboard.layout).toEqual({ kind: 'NotebookLayout', spec: { cells: expect.any(Array) } });
    expect(dashboard.elements.intro).toEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Markdown', spec: { text: '## What we know' } } },
    });
  });

  it('upgrades v2beta1 panel transformations to the v2 shape the scene speaks', () => {
    const notebook = makeNotebook({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture
      elements: {
        'panel-1': panelWithTransformations([{ kind: 'organize', spec: { id: 'organize', options: { a: 1 } } }]),
      } as unknown as NotebookSpec['elements'],
    });

    const dashboard = notebookSpecToDashboardSpec(notebook);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- reading into the fixture
    const element = dashboard.elements['panel-1'] as unknown as ReturnType<typeof panelWithTransformations>;
    expect(element.spec.data.spec.transformations).toEqual([
      { kind: 'Transformation', group: 'organize', spec: { options: { a: 1 } } },
    ]);
  });

  it('leaves panels without transformations alone', () => {
    const notebook = makeNotebook({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture
      elements: { 'panel-1': panelWithTransformations([]) } as unknown as NotebookSpec['elements'],
    });

    expect(notebookSpecToDashboardSpec(notebook).elements['panel-1']).toBe(notebook.elements['panel-1']);
  });
});

describe('dashboardSpecToNotebookSpec', () => {
  function serializedNotebookScene(overrides: Record<string, unknown> = {}): DashboardV2Spec {
    // What transformSceneToSaveModelSchemaV2 emits for a notebook: the notebook's own fields plus
    // the full set of dashboard-only fields it always writes.
    const spec = {
      ...notebookSpecToDashboardSpec(makeNotebook()),
      variables: [],
      annotations: [],
      links: [],
      cursorSync: 'Crosshair',
      liveNow: true,
      preload: true,
      editable: true,
      revision: 7,
      ...overrides,
    };
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture
    return spec as unknown as DashboardV2Spec;
  }

  it('drops every dashboard-only field', () => {
    const notebook = dashboardSpecToNotebookSpec(serializedNotebookScene());

    expect(Object.keys(notebook).sort()).toEqual(['elements', 'layout', 'tags', 'timeSettings', 'title']);
  });

  it('drops an empty description so it round-trips back to absent', () => {
    expect(dashboardSpecToNotebookSpec(serializedNotebookScene({ description: '' })).description).toBeUndefined();
    expect(dashboardSpecToNotebookSpec(serializedNotebookScene({ description: 'why' })).description).toBe('why');
  });

  it('downgrades v2 panel transformations back to the v2beta1 wire shape', () => {
    const spec = serializedNotebookScene({
      elements: {
        'panel-1': panelWithTransformations([
          { kind: 'Transformation', group: 'organize', spec: { options: { a: 1 }, disabled: true } },
        ]),
      },
    });

    const notebook = dashboardSpecToNotebookSpec(spec);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- reading into the fixture
    const element = notebook.elements['panel-1'] as unknown as ReturnType<typeof panelWithTransformations>;
    expect(element.spec.data.spec.transformations).toEqual([
      { kind: 'organize', spec: { id: 'organize', options: { a: 1 }, disabled: true } },
    ]);
  });

  it('produces a spec that passes notebook validation, transformations included', () => {
    const spec = serializedNotebookScene({
      elements: {
        intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'x' } } } },
        'panel-1': panelWithTransformations([{ kind: 'Transformation', group: 'limit', spec: { options: {} } }]),
      },
      layout: {
        kind: 'NotebookLayout',
        spec: {
          cells: [
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'user' },
            },
            {
              kind: 'NotebookLayoutItem',
              spec: { element: { kind: 'ElementReference', name: 'panel-1' }, source: 'assistant' },
            },
          ],
        },
      },
    });

    const result = notebookSpecSchema.safeParse(dashboardSpecToNotebookSpec(spec));
    expect(result.success).toBe(true);
  });
});

describe('round trip', () => {
  it('returns the same notebook after widening and narrowing', () => {
    const notebook = makeNotebook();

    expect(dashboardSpecToNotebookSpec(notebookSpecToDashboardSpec(notebook))).toEqual(notebook);
  });

  it('preserves a panel transformation across both conversions', () => {
    const notebook = makeNotebook({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture
      elements: {
        'panel-1': panelWithTransformations([{ kind: 'organize', spec: { id: 'organize', options: { a: 1 } } }]),
      } as unknown as NotebookSpec['elements'],
    });

    expect(dashboardSpecToNotebookSpec(notebookSpecToDashboardSpec(notebook))).toEqual(notebook);
  });
});

describe('isNotebookScene', () => {
  it('is true for a scene whose layout manager is the notebook layout', () => {
    expect(isNotebookScene({ state: { body: { descriptor: { id: 'NotebookLayout' } } } })).toBe(true);
  });

  it.each([['GridLayout'], ['RowsLayout'], ['TabsLayout'], ['AutoGridLayout']])('is false for a %s dashboard', (id) => {
    expect(isNotebookScene({ state: { body: { descriptor: { id } } } })).toBe(false);
  });

  it('is false when the scene has no layout manager yet', () => {
    expect(isNotebookScene({ state: { body: undefined } })).toBe(false);
  });
});

describe('setNotebookDocumentHeader', () => {
  it('pushes title and tags onto a notebook layout manager', () => {
    const setState = jest.fn();

    setNotebookDocumentHeader({ descriptor: { id: 'NotebookLayout' }, setState }, 'Title', ['a']);

    expect(setState).toHaveBeenCalledWith({ title: 'Title', tags: ['a'] });
  });

  it('is a no-op on a dashboard layout manager', () => {
    const setState = jest.fn();

    setNotebookDocumentHeader({ descriptor: { id: 'GridLayout' }, setState }, 'Title', ['a']);

    expect(setState).not.toHaveBeenCalled();
  });
});
