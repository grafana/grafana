/**
 * The dashboard half of the full-spec surface, driven end to end: a real scene built from a v2 spec,
 * the real GET_SPEC / APPLY_SPEC handlers, the real serializer.
 *
 * It exists because the element-identity fix changes dashboard behaviour on purpose. An element name
 * the caller chose used to be rekeyed to `panel-<id>` by the rebuild, and now survives, so that has
 * to be pinned somewhere a dashboard reviewer will look rather than only in the notebook suite.
 */

import {
  defaultPanelKind,
  type PanelKind,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { type DashboardScene } from '../../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';

import { applySpecCommand } from './applySpec';
import { getSpecCommand } from './getSpec';
import { type MutationContext } from './types';

// Entering edit mode starts the change tracker, which spawns a real web worker. jsdom has none, and
// the global worker mock covers other features only.
jest.mock('../../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

function panelElement(id: number, title: string): PanelKind {
  const panel = defaultPanelKind();
  return {
    ...panel,
    spec: {
      ...panel.spec,
      id,
      title,
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
        },
      },
      vizConfig: { ...panel.spec.vizConfig, group: 'timeseries', version: '1.0.0' },
    },
  };
}

function gridItem(name: string, y: number) {
  return {
    kind: 'GridLayoutItem',
    spec: { x: 0, y, width: 12, height: 8, element: { kind: 'ElementReference', name } },
  };
}

/**
 * The loaded panel is named `latency-panel`, not `panel-1`: the canonical name is what hides an
 * element-identity problem, so a fixture using it would pass either way.
 */
function makeDashboardSpec(overrides: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  const spec = {
    title: 'Checkout latency',
    description: '',
    cursorSync: 'Off',
    liveNow: false,
    preload: false,
    editable: true,
    tags: [],
    links: [],
    annotations: [],
    variables: [],
    timeSettings: {
      from: 'now-6h',
      to: 'now',
      autoRefresh: '',
      autoRefreshIntervals: ['5s', '1m'],
      hideTimepicker: false,
      fiscalYearStartMonth: 0,
      timezone: 'browser',
    },
    elements: { 'latency-panel': panelElement(1, 'p99 latency') },
    layout: { kind: 'GridLayout', spec: { items: [gridItem('latency-panel', 0)] } },
    ...overrides,
  };

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- hand-built fixture matching the generated spec
  return spec as unknown as DashboardV2Spec;
}

function buildDashboardScene(spec: DashboardV2Spec): DashboardScene {
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  // Deliberately not activated, matching the notebook suite: the full-spec commands serialize from
  // scene state, and activating starts the annotation data layer and the dashboard macro.
  return transformSaveModelSchemaV2ToScene(dto);
}

function contextFor(scene: DashboardScene): MutationContext {
  return { scene };
}

async function getSpec(scene: DashboardScene, validate = false) {
  return getSpecCommand.handler({ validate }, contextFor(scene));
}

async function applySpec(scene: DashboardScene, spec: unknown, validate = false) {
  return applySpecCommand.handler({ spec: spec as Record<string, unknown>, validate }, contextFor(scene));
}

function specOf(result: Awaited<ReturnType<typeof getSpec>>): DashboardV2Spec {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: DashboardV2Spec }).spec;
}

function referencedNames(spec: DashboardV2Spec): string[] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fixture is a grid layout throughout
  const items = (spec.layout as { spec: { items: Array<{ spec: { element: { name: string } } }> } }).spec.items;
  return items.map((item) => item.spec.element.name);
}

/** Layout references with no element to resolve to: the shape a lost panel takes in a spec. */
function danglingReferences(spec: DashboardV2Spec): string[] {
  return referencedNames(spec).filter((name) => !spec.elements[name]);
}

/** A snapshot of the unsaved-changes baseline, which the reseed must leave alone. */
function baselineOf(scene: DashboardScene): unknown {
  return JSON.parse(JSON.stringify(scene.serializer.initialSaveModel ?? null));
}

describe('GET_SPEC on a dashboard', () => {
  it('keeps the element name the dashboard was loaded with', async () => {
    const spec = specOf(await getSpec(buildDashboardScene(makeDashboardSpec())));

    expect(Object.keys(spec.elements)).toEqual(['latency-panel']);
    expect(danglingReferences(spec)).toEqual([]);
  });
});

describe('APPLY_SPEC on a dashboard', () => {
  it('keeps the element name of a panel added by the caller', async () => {
    const scene = buildDashboardScene(makeDashboardSpec());
    const added = makeDashboardSpec({
      elements: {
        'latency-panel': panelElement(1, 'p99 latency'),
        'errors-panel': panelElement(2, '5xx rate'),
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
    expect(danglingReferences(spec)).toEqual([]);
  });

  it('keeps a newly added panel when the spec it read back is applied again', async () => {
    const scene = buildDashboardScene(makeDashboardSpec());
    const added = makeDashboardSpec({
      elements: {
        'latency-panel': panelElement(1, 'p99 latency'),
        'errors-panel': panelElement(2, '5xx rate'),
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
    expect(danglingReferences(spec)).toEqual([]);
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
