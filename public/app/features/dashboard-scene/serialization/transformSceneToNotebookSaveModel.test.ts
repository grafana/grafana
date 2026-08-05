import { defaultPanelKind, type PanelKind, type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { buildNotebookEnvelope } from 'app/features/notebook/scene/buildNotebookEnvelope';

import { type DashboardScene } from '../scene/DashboardScene';

import { downgradeElementsToNotebookWire } from './notebookSpecTransform';
import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToNotebookSaveModel } from './transformSceneToNotebookSaveModel';
import { getElements } from './transformSceneToSaveModelSchemaV2';

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
  // What replaced the equivalence check this file used to carry.
  //
  // That one compared the notebook spec against
  // `dashboardSpecToNotebookSpec(transformSceneToSaveModelSchemaV2(scene))`, and it did its job: it
  // passed at the exact moment the body stopped routing through the dashboard serializer, which is
  // what made the swap safe. It could not survive the second half of the change, because the
  // dashboard serializer deliberately stopped emitting narrative cells, so the reference side lost
  // every markdown and code cell and no longer described a notebook.
  //
  // This is the invariant that outlives it, and the one that would actually catch a regression: the
  // panel elements in a notebook spec are the ones the shared builder produced, not a second
  // derivation. Two functions computing an element key that nothing forces to agree is the bug this
  // whole change came from, so it is worth an assertion rather than a comment.
  it('takes its panel elements from the shared element builder rather than deriving them again', () => {
    const scene = buildNotebookScene();

    const spec = transformSceneToNotebookSaveModel(scene);
    const shared = getElements(scene, scene.serializer.getDSReferencesMapping());

    const panelNames = Object.keys(shared);
    expect(panelNames).toEqual(['latency-panel']);
    for (const name of panelNames) {
      // Compared after the notebook's wire downgrade, which is the one transformation applied on top.
      expect(spec.elements[name]).toEqual(downgradeElementsToNotebookWire(shared)[name]);
    }
  });

  // The cells the shared builder cannot see. Together with the case above this says the elements map
  // is exactly panels-from-the-shared-builder plus the notebook's own cells, and nothing else.
  it('adds the narrative cells the shared element builder cannot see', () => {
    const scene = buildNotebookScene();

    const spec = transformSceneToNotebookSaveModel(scene);
    const sharedPanelNames = Object.keys(getElements(scene, scene.serializer.getDSReferencesMapping()));
    const cellNames = Object.keys(spec.elements).filter((name) => !sharedPanelNames.includes(name));

    expect(cellNames.sort()).toEqual(['intro', 'repro']);
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
