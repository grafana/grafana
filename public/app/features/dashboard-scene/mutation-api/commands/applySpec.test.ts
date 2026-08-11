/**
 * APPLY_SPEC while a panel is open for editing.
 *
 * The command rebuilds the scene from the spec and swaps the result in, and `setState` merges, so an
 * editor opened before the swap survives it still driving a VizPanel the dashboard no longer
 * contains. These drive the real command against a real scene rather than the re-attach on its own:
 * the reported symptom is that an edit made after the swap is missing from what a read returns, so
 * that is what is asserted.
 */

import { cloneDeep } from 'lodash';

import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { handyTestingSchema } from '@grafana/schema/apis/dashboard.grafana.app/v2/examples';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { buildPanelEditScene } from '../../panel-edit/PanelEditor';
import { type DashboardScene } from '../../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { findVizPanelByKey, getLibraryPanelBehavior } from '../../utils/utils';

import { applySpecCommand } from './applySpec';
import { getSpecCommand } from './getSpec';
import { type MutationContext } from './types';

// Entering edit mode starts the change tracker, which spawns a real web worker jsdom does not have.
jest.mock('../../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ getInstanceSettings: jest.fn() }),
}));

/**
 * `handyTestingSchema` holds `panel-1` (a plain panel) and `panel-2` (a library panel). Its
 * variables are dropped: they are irrelevant here and some are behind a feature toggle.
 */
function makeSpec(mutate?: (spec: DashboardV2Spec) => void): DashboardV2Spec {
  const spec = cloneDeep(handyTestingSchema);
  spec.variables = [];
  mutate?.(spec);
  return spec;
}

function withoutPanel1(spec: DashboardV2Spec) {
  delete spec.elements['panel-1'];
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fixture is a grid layout
  const layout = spec.layout as { spec: { items: Array<{ spec: { element: { name: string } } }> } };
  layout.spec.items = layout.spec.items.filter((item) => item.spec.element.name !== 'panel-1');
}

function buildScene(spec: DashboardV2Spec): DashboardScene {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-03T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec,
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  return transformSaveModelSchemaV2ToScene(dto);
}

async function applySpec(scene: DashboardScene, spec: DashboardV2Spec) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the payload schema takes an opaque record
  const payload = { spec: spec as unknown as Record<string, unknown>, validate: false };
  return applySpecCommand.handler(payload, { scene } satisfies MutationContext);
}

async function readSpec(scene: DashboardScene): Promise<DashboardV2Spec> {
  const result = await getSpecCommand.handler({ validate: false }, { scene } satisfies MutationContext);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- handler data is untyped by the MutationResult contract
  return (result.data as { spec: DashboardV2Spec }).spec;
}

function openPanelEdit(scene: DashboardScene, key: string) {
  const panel = findVizPanelByKey(scene, key)!;
  scene.onEnterEditMode();
  scene.setState({ editPanel: buildPanelEditScene(panel) });
  return panel;
}

/**
 * Assertions read these rather than the scene objects themselves: a failed `toBe` on a VizPanel
 * sends the whole circular tree over jest's worker IPC and kills the run.
 */
function editedPanelKey(scene: DashboardScene) {
  return scene.state.editPanel?.state.panelRef.resolve().state.key;
}

/** Whether the editor drives the object the dashboard currently holds, rather than a discarded one. */
function editorIsAttached(scene: DashboardScene) {
  const panel = scene.state.editPanel?.state.panelRef.resolve();
  return panel !== undefined && panel === findVizPanelByKey(scene, panel.state.key!);
}

describe('APPLY_SPEC with a panel open for editing', () => {
  it('re-binds the editor onto the panel in the rebuilt tree', async () => {
    const scene = buildScene(makeSpec());
    const beforeSwap = openPanelEdit(scene, 'panel-1');

    expect((await applySpec(scene, makeSpec())).success).toBe(true);

    expect(editedPanelKey(scene)).toBe('panel-1');
    expect(scene.state.editPanel!.state.panelRef.resolve() === beforeSwap).toBe(false);
    expect(editorIsAttached(scene)).toBe(true);
  });

  it('keeps an edit made through the editor after the rebuild visible to a read', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-1');

    await applySpec(scene, makeSpec());
    scene.state.editPanel!.state.panelRef.resolve().setState({ title: 'Renamed by user' });

    expect((await readSpec(scene)).elements['panel-1']).toMatchObject({ spec: { title: 'Renamed by user' } });
  });

  it('closes the editor when the applied spec no longer has the panel', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-1');
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await applySpec(scene, makeSpec(withoutPanel1));

    expect(editedPanelKey(scene)).toBeUndefined();
    expect(findVizPanelByKey(scene, 'panel-1')).toBeNull();
  });

  it('waits for a library panel to load before re-opening the editor on it', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-2');

    await applySpec(scene, makeSpec());

    // The rebuild resets library panels to unloaded; opening now would edit an empty shell.
    const libPanel = getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!;
    expect(libPanel.state.isLoaded).toBeFalsy();
    expect(editedPanelKey(scene)).toBeUndefined();

    libPanel.setState({ isLoaded: true });
    expect(editedPanelKey(scene)).toBe('panel-2');
    expect(editorIsAttached(scene)).toBe(true);
  });

  it('recovers the pane when a second rebuild lands during the library-panel wait', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-2');

    await applySpec(scene, makeSpec());
    const stale = getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!;
    // `editPanel` is unset for the whole wait, so this rebuild has no key to re-open from.
    await applySpec(scene, makeSpec());
    expect(editedPanelKey(scene)).toBeUndefined();

    // The load the discarded tree started completes, and hands off to the live tree's own wait.
    stale.setState({ isLoaded: true });
    expect(editedPanelKey(scene)).toBeUndefined();

    getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!.setState({ isLoaded: true });
    expect(editedPanelKey(scene)).toBe('panel-2');
    expect(editorIsAttached(scene)).toBe(true);
  });

  it('recovers the pane when a rebuild races an in-flight `?editPanel=` wait', async () => {
    const scene = buildScene(makeSpec());
    scene.onEnterEditMode();

    // Open panel edit the way the URL does, while the library panel is still loading.
    const stale = getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!;
    scene.urlSync!.updateFromUrl({ editPanel: '2' });
    expect(editedPanelKey(scene)).toBeUndefined();

    await applySpec(scene, makeSpec());
    stale.setState({ isLoaded: true });
    getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!.setState({ isLoaded: true });

    expect(editedPanelKey(scene)).toBe('panel-2');
    expect(editorIsAttached(scene)).toBe(true);
  });

  it('leaves the editor closed when none was open', async () => {
    const scene = buildScene(makeSpec());

    expect((await applySpec(scene, makeSpec())).success).toBe(true);

    expect(editedPanelKey(scene)).toBeUndefined();
  });
});
