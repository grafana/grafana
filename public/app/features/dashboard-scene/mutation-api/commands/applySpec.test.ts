/**
 * APPLY_SPEC: replacing a whole dashboard, and refusing anything that is not one.
 *
 * The element-identity cases are here rather than in the notebook suite on purpose: the reseed after a
 * rebuild changes dashboard behaviour, so it has to be pinned where a dashboard reviewer will look.
 */

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type DashboardScene } from '../../scene/DashboardScene';
import { DashboardMutationClient } from '../DashboardMutationClient';

import { applySpecCommand } from './applySpec';
import { getNotebookSpecCommand } from './getNotebookSpec';
import { getSpecCommand } from './getSpec';
import {
  baselineOf,
  buildDashboardScene,
  buildNotebookScene,
  contextFor,
  dashboardDanglingReferences,
  dashboardPanelElement,
  gridItem,
  makeDashboardSpec,
  makeNotebookSpec,
  specOf as notebookSpecOf,
} from './test-utils';

// Entering edit mode starts the change tracker, which spawns a real web worker. jsdom has none, and
// the global worker mock covers other features only.
jest.mock('../../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

let notebooksFlagEnabled = true;

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: () => ({ getBooleanValue: () => notebooksFlagEnabled }),
}));

async function getSpec(scene: DashboardScene, validate = false) {
  return getSpecCommand.handler({ validate }, contextFor(scene));
}

async function applySpec(scene: DashboardScene, spec: unknown, validate = false) {
  return applySpecCommand.handler({ spec: spec as Record<string, unknown>, validate }, contextFor(scene));
}

async function getNotebookSpec(scene: DashboardScene) {
  return getNotebookSpecCommand.handler({ validate: false }, contextFor(scene));
}

function specOf(result: Awaited<ReturnType<typeof getSpec>>): DashboardV2Spec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: DashboardV2Spec }).spec;
}

function clientFor(scene: DashboardScene) {
  return new DashboardMutationClient(scene);
}

describe('APPLY_SPEC on a dashboard', () => {
  it('keeps the element name of a panel added by the caller', async () => {
    const scene = buildDashboardScene(makeDashboardSpec());
    const added = makeDashboardSpec({
      elements: {
        'latency-panel': dashboardPanelElement(1, 'p99 latency'),
        'errors-panel': dashboardPanelElement(2, '5xx rate'),
      },
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built grid layout
      layout: {
        kind: 'GridLayout',
        spec: { items: [gridItem('latency-panel', 0), gridItem('errors-panel', 8)] },
      } as unknown as DashboardV2Spec['layout'],
    });

    expect((await applySpec(scene, added)).success).toBe(true);
    const spec = specOf(await getSpec(scene));

    expect(Object.keys(spec.elements).sort()).toEqual(['errors-panel', 'latency-panel']);
    expect(spec.elements['errors-panel'].spec.id).toBe(2);
    expect(dashboardDanglingReferences(spec)).toEqual([]);
  });

  it('keeps a newly added panel when the spec it read back is applied again', async () => {
    const scene = buildDashboardScene(makeDashboardSpec());
    const added = makeDashboardSpec({
      elements: {
        'latency-panel': dashboardPanelElement(1, 'p99 latency'),
        'errors-panel': dashboardPanelElement(2, '5xx rate'),
      },
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built grid layout
      layout: {
        kind: 'GridLayout',
        spec: { items: [gridItem('latency-panel', 0), gridItem('errors-panel', 8)] },
      } as unknown as DashboardV2Spec['layout'],
    });

    await applySpec(scene, added);
    const readBack = specOf(await getSpec(scene));

    expect((await applySpec(scene, readBack)).success).toBe(true);
    const spec = specOf(await getSpec(scene));

    expect(Object.keys(spec.elements).sort()).toEqual(['errors-panel', 'latency-panel']);
    expect(dashboardDanglingReferences(spec)).toEqual([]);
  });

  // The reseed uses initializeElementMapping rather than setInitialSaveModel precisely so the
  // baseline the unsaved-changes diff compares against does not move.
  it('leaves the unsaved-changes baseline untouched', async () => {
    const scene = buildDashboardScene(makeDashboardSpec());
    const before = baselineOf(scene);

    await applySpec(scene, makeDashboardSpec({ title: 'Renamed' }));

    expect(baselineOf(scene)).toEqual(before);
  });
});

/**
 * The other half of the contract: asked of a notebook, this command refuses.
 *
 * Driven through the client rather than the handler, because the refusal lives in the permission rule
 * and the client is what runs it. That is also why it is worth a case: a handler reached on the wrong
 * resource does not fail loudly. It would serialize the notebook through the dashboard serializer and
 * hand back a spec with every narrative cell missing.
 */
describe('APPLY_SPEC on a notebook', () => {
  it('APPLY_SPEC refuses without touching the notebook', async () => {
    const scene = buildNotebookScene(makeNotebookSpec());
    const before = notebookSpecOf(await getNotebookSpec(scene));

    const result = await clientFor(scene).execute({
      type: 'APPLY_SPEC',
      payload: { spec: { ...before, title: 'Written by the wrong command' } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('APPLY_NOTEBOOK_SPEC');
    expect(notebookSpecOf(await getNotebookSpec(scene))).toEqual(before);
  });
});
