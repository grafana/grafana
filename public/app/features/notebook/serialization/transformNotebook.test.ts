// defaultDataQueryKind is not re-exported by ../types (that seam covers the notebook-specific and
// forked names); it is a shared leaf type, so it comes straight from the generated module.
import { defaultDataQueryKind } from '@grafana/schema/apis/notebook/v2beta1';
import { type Resource } from 'app/features/apiserver/types';

import { NotebookScene } from '../scene/NotebookScene';
import { defaultSpec as defaultNotebookSpec, type NotebookElement, type Spec as NotebookSpec } from '../types';

import { transformNotebookSceneToSaveModel } from './transformNotebookSceneToSaveModel';
import { transformNotebookToScene } from './transformNotebookToScene';

// The spec fixture is written in the serializer's canonical form (explicit datasource per query,
// description always present on panels, version '' etc.) so spec → scene → spec is an exact
// round-trip. This is the contract the Mutation API's GET_NOTEBOOK_SPEC depends on.
function notebookSpec(): NotebookSpec {
  const elements: Record<string, NotebookElement> = {
    intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '## Checkout latency spike' } } } },
    query: { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language: 'promql', code: 'up == 0' } } } },
    // A LibraryPanel cell serializes down a different branch to a Panel one: vizPanelToSchemaV2 only
    // emits LibraryPanelKind when it finds the behavior buildLibraryPanelState attaches, and otherwise
    // falls through and inlines the panel. Without a library element in this fixture, a notebook cell
    // built without that behavior would silently save as a fully inlined PanelKind — the library
    // reference gone from the spec and edits to the library panel no longer propagating — and nothing
    // here would fail. `id` and `title` mirror what the deserializer puts on the VizPanel so the
    // round-trip stays exact, same as the Panel fixture. Nothing activates the cell, so the library
    // panel is never fetched and no API mock is needed.
    'saved-cpu-panel': {
      kind: 'LibraryPanel',
      spec: {
        id: 2,
        title: 'CPU usage',
        libraryPanel: { uid: 'lib-cpu-1', name: 'CPU usage' },
      },
    },
    'latency-panel': {
      kind: 'Panel',
      spec: {
        id: 1,
        title: 'p95 latency',
        description: '',
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
                  query: {
                    kind: 'DataQuery',
                    version: defaultDataQueryKind().version,
                    group: 'prometheus',
                    // Explicit datasource: without a DSReferencesMapping the serializer writes the
                    // runtime-resolved datasource back, so only explicit refs round-trip exactly.
                    datasource: { name: 'gdev-prometheus' },
                    spec: { expr: 'histogram_quantile(0.95, http_request_duration_seconds_bucket)' },
                  },
                },
              },
            ],
            // The notebook carries the dashboard v2 transformation shape: the transform id lives in
            // `group`, and the spec has no `id`. Pinning it here is what would catch a regression to
            // the old v2beta1 wire form ({ kind: <id>, spec: { id: <id> } }), which the notebook CUE
            // schema no longer describes.
            transformations: [{ kind: 'Transformation', group: 'limit', spec: { options: { limitField: 10 } } }],
            queryOptions: {},
          },
        },
        vizConfig: {
          kind: 'VizConfig',
          group: 'timeseries',
          version: '',
          spec: {
            options: {},
            fieldConfig: { defaults: {}, overrides: [] },
          },
        },
      },
    },
  };

  return {
    ...defaultNotebookSpec(),
    title: 'Checkout latency investigation',
    description: 'What happened on checkout during the deploy',
    tags: ['incident', 'checkout'],
    timeSettings: {
      from: 'now-6h',
      to: 'now',
      timezone: 'utc',
      autoRefresh: '30s',
      autoRefreshIntervals: ['5s', '30s', '1m'],
      hideTimepicker: false,
      fiscalYearStartMonth: 0,
    },
    elements,
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'intro' }, source: 'assistant' },
          },
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'latency-panel' }, source: 'user', collapsed: false },
          },
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'query' }, source: 'user' },
          },
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'saved-cpu-panel' }, source: 'user' },
          },
        ],
      },
    },
  };
}

function notebookResource(): Resource<NotebookSpec> {
  return {
    apiVersion: 'dashboard.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', resourceVersion: '1', creationTimestamp: '2026-07-01T00:00:00Z' },
    spec: notebookSpec(),
  };
}

describe('transformNotebookToScene / transformNotebookSceneToSaveModel', () => {
  it('builds a NotebookScene with the document, time controls and header state', () => {
    const scene = transformNotebookToScene(notebookResource());

    expect(scene).toBeInstanceOf(NotebookScene);
    expect(scene.state.title).toBe('Checkout latency investigation');
    expect(scene.state.uid).toBe('nb-1');
    expect(scene.state.hideTimeControls).toBe(false);
    expect(scene.state.$timeRange.state.from).toBe('now-6h');
    expect(scene.state.body.state.cells).toHaveLength(4);
    // Title and tags are surfaced on the layout manager for the document header.
    expect(scene.state.body.state.title).toBe('Checkout latency investigation');
    expect(scene.state.body.state.tags).toEqual(['incident', 'checkout']);
  });

  it('round-trips the full spec: cells, order, source, timeSettings and metadata', () => {
    const spec = notebookSpec();

    const scene = transformNotebookToScene(notebookResource());
    const saveModel = transformNotebookSceneToSaveModel(scene);

    expect(saveModel).toEqual(spec);
  });
});
