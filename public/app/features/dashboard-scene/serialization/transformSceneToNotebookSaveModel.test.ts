import { defaultPanelKind, type PanelKind, type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { buildNotebookEnvelope } from 'app/features/notebook/scene/buildNotebookEnvelope';

import { type DashboardScene } from '../scene/DashboardScene';

import { dashboardSpecToNotebookSpec } from './notebookSpecTransform';
import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToNotebookSaveModel } from './transformSceneToNotebookSaveModel';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

const timeSettings = {
  from: 'now-6h',
  to: 'now',
  autoRefresh: '',
  autoRefreshIntervals: ['5s', '1m'],
  hideTimepicker: false,
  fiscalYearStartMonth: 0,
  timezone: 'browser',
};

/**
 * A panel carrying a transformation in the notebook's v2beta1 wire shape (`kind` holds the
 * transformation id and `spec.id` duplicates it), which is what the resource really stores.
 */
function panelWithTransformation(): PanelKind {
  const panel = defaultPanelKind();
  return {
    ...panel,
    spec: {
      ...panel.spec,
      id: 1,
      title: 'p99 latency',
      data: {
        ...panel.spec.data,
        spec: {
          ...panel.spec.data.spec,
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
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the v2beta1 wire shape, which is what a stored notebook carries
          transformations: [
            { kind: 'limit', spec: { id: 'limit', options: { limitField: 5 } } },
          ] as unknown as (typeof panel.spec.data.spec)['transformations'],
        },
      },
      vizConfig: { ...panel.spec.vizConfig, group: 'timeseries', version: '1.0.0' },
    },
  };
}

function makeNotebookSpec(): NotebookSpec {
  const spec = {
    title: 'Checkout latency investigation',
    description: 'p99 spike on the payments path',
    tags: ['incident'],
    timeSettings,
    elements: {
      intro: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: '## What we know' } } } },
      'latency-panel': panelWithTransformation(),
      repro: { kind: 'Cell', spec: { content: { kind: 'Code', spec: { language: 'promql', code: 'up' } } } },
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
            spec: { element: { kind: 'ElementReference', name: 'latency-panel' }, source: 'assistant' },
          },
          {
            kind: 'NotebookLayoutItem',
            spec: { element: { kind: 'ElementReference', name: 'repro' }, source: 'assistant' },
          },
        ],
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture matching the generated spec
  return spec as unknown as NotebookSpec;
}

/** Built the way the notebook page builds one, and not activated, matching the command suites. */
function buildNotebookScene(): DashboardScene {
  const envelope = buildNotebookEnvelope({
    apiVersion: 'notebook.grafana.app/v2beta1',
    kind: 'Notebook',
    metadata: { name: 'nb-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    spec: makeNotebookSpec(),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  } as unknown as Parameters<typeof buildNotebookEnvelope>[0]);

  return transformSaveModelSchemaV2ToScene(envelope);
}

describe('transformSceneToNotebookSaveModel', () => {
  // Step 1 is a wrapper, so this compares the new entry point against the two calls the commands
  // used to make. It is nearly a tautology today on purpose: its job is to be the reference when
  // step 2 replaces the body with a composition that no longer routes through the dashboard
  // serializer. Do not delete it as redundant, it is the only thing pinning that swap.
  it('returns exactly what the dashboard serializer plus the notebook projection returns', () => {
    const scene = buildNotebookScene();

    const reference = dashboardSpecToNotebookSpec(transformSceneToSaveModelSchemaV2(scene));

    expect(transformSceneToNotebookSaveModel(scene)).toEqual(reference);
  });

  // The scene speaks the v2 stable transformation shape, the notebook resource stores the v2beta1
  // one, so serializing has to downgrade on the way out. Asserted on shape rather than against the
  // input panel, because the round trip through the scene fills in `disabled` and `filter`.
  it('downgrades panel transformations back to the notebook wire shape', () => {
    const spec = transformSceneToNotebookSaveModel(buildNotebookScene());

    const panel = spec.elements['latency-panel'];
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing the element union to the panel the fixture put there
    const transformations = (panel as PanelKind).spec.data.spec.transformations;

    expect(transformations).toHaveLength(1);
    expect(transformations[0].kind).toBe('limit');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- v2beta1 duplicates the id inside spec
    expect((transformations[0].spec as { id: string }).id).toBe('limit');
  });

  // The serializer emits the full dashboard shape, so anything it adds has to be dropped here rather
  // than carried into a resource with no such fields.
  it('carries the notebook fields and none of the dashboard ones', () => {
    const spec = transformSceneToNotebookSaveModel(buildNotebookScene());

    expect(Object.keys(spec).sort()).toEqual(['description', 'elements', 'layout', 'tags', 'timeSettings', 'title']);
  });
});
