/**
 * APPLY_SPEC while a panel is open for editing.
 *
 * The command rebuilds the scene from the spec and swaps the result in, and `setState` merges, so an
 * editor opened before the swap survives it still driving a VizPanel the dashboard no longer
 * contains. These drive the real command against a real scene rather than the re-attach on its own:
 * the reported symptom is that an edit made after the swap is missing from what a read returns, so
 * that is what is asserted.
 */

import { waitFor } from '@testing-library/react';
import { cloneDeep } from 'lodash';
import { of } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { locationService, reportInteraction, setPluginImportUtils, setRunRequest } from '@grafana/runtime';
import { type Spec as DashboardV2Spec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { handyTestingSchema } from '@grafana/schema/apis/dashboard.grafana.app/v2/examples';
import { setTestFlags } from '@grafana/test-utils/feature-flags';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { dataSource as expressionDataSource } from 'app/features/expressions/ExpressionDatasource';
import { dashboardMutationApi } from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationApi';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { applyDashboardSpec, swapInReloadedDashboard } from '../../actions/dashboard/applyDashboardSpec';
import { changeViewPanelOptions } from '../../actions/panel/changeViewPanelOptions';
import { endBatch as endEditBatch, startBatch as startEditBatch } from '../../actions/utils/batch';
import { edit } from '../../actions/utils/edit';
import {
  clearPendingChangePreview,
  getPendingChangesHistory,
  loadPendingChangePreview,
  type PendingChangesHistory,
} from '../../lifecycle/pendingChangePreview';
import { setPendingChangesPageReload } from '../../lifecycle/pendingChangesPageReload';
import { QueryCoauthoringSessionEngine } from '../../panel-edit/PanelEditNext/QueryEditor/coauthoring/QueryCoauthoringSessionEngine';
import { buildPanelEditScene } from '../../panel-edit/PanelEditor';
import { type DashboardScene } from '../../scene/DashboardScene';
import { dashboardViews } from '../../scene/dashboardViewRegistry';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { transformSaveModelSchemaV2ToScene } from '../../serialization/transformSaveModelSchemaV2ToScene';
import { findVizPanelByKey } from '../../utils/findVizPanel';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { createDeferred } from '../../utils/test-utils';
import { getLibraryPanelBehavior } from '../../utils/utils';

import { applySpecCommand } from './applySpec';
import { getSpecCommand } from './getSpec';
import { endBatchCommand, getLastActionCommand, redoCommand, startBatchCommand, undoCommand } from './history';
import { enterEditModeIfNeeded, type MutationContext } from './types';

jest.mock('app/features/plugins/extensions/registry/setup', () => ({ getPluginExtensionRegistries: jest.fn() }));
jest.mock('app/features/plugins/extensions/utils', () => ({
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));

// Entering edit mode starts the change tracker, which spawns a real web worker jsdom does not have.
jest.mock('../../saving/createDetectChangesWorker', () => ({
  createWorker: () => ({ postMessage: jest.fn(), terminate: jest.fn(), onmessage: null }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ getInstanceSettings: jest.fn(), get: () => Promise.resolve(mockCoauthoringDatasource) }),
  getDataSourceInstance: () => Promise.resolve(mockCoauthoringDatasource),
  getDataSourceInstanceSettings: async () => undefined,
  reportInteraction: jest.fn(),
}));

jest.mock('app/features/library-panels/state/api', () => ({
  ...jest.requireActual('app/features/library-panels/state/api'),
  getLibraryPanel: jest.fn(() => new Promise(() => {})),
}));

const mockCoauthoringDatasource = Object.assign(getMockDataSource(), {
  queryCoauthoring: () => expressionDataSource.queryCoauthoring(),
});

let cachedPanelPlugin: ReturnType<typeof getPanelPlugin> | undefined;
beforeAll(() =>
  setPluginImportUtils({
    importPanelPlugin: async () => cachedPanelPlugin ?? getPanelPlugin({}),
    getPanelPluginFromCache: () => cachedPanelPlugin,
  })
);
afterEach(() => {
  cachedPanelPlugin = undefined;
});

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

async function applySpec(scene: DashboardScene, spec: DashboardV2Spec, validate = false) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the payload schema takes an opaque record
  const payload = { spec: spec as unknown as Record<string, unknown>, validate };
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

describe('APPLY_SPEC during review', () => {
  beforeEach(() => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('keeps the rebuilt grid non-draggable until the user returns to Edit', async () => {
    const scene = buildScene(makeSpec());
    scene.onEnterEditMode();
    scene.setDashboardMode('view');

    try {
      const result = await scene.withAssistantWrite(() =>
        applySpec(
          scene,
          makeSpec((spec) => {
            spec.title = 'Replacement during review';
          })
        )
      );

      expect(result.success).toBe(true);
      expect((await readSpec(scene)).title).toBe('Replacement during review');
      expect(scene.state.mode).toBe('agent');
      expect(scene.state.sidebar.state.selectionContext.enabled).toBe(false);
      const layout = scene.state.body;
      if (!(layout instanceof DefaultGridLayoutManager)) {
        throw new Error('Expected the replacement spec to use a grid layout');
      }
      expect(layout.state.grid.state.isDraggable).toBe(false);

      scene.openFullEditor();

      await waitFor(() => expect(layout.state.grid.state.isDraggable).toBe(true));
      expect(scene.state.sidebar.state.selectionContext.enabled).toBe(true);

      scene.exitEditMode({ skipConfirm: true, restoreInitialState: true });
      expect((await readSpec(scene)).title).toBe(handyTestingSchema.title);
    } finally {
      if (scene.state.isEditing) {
        scene.exitEditMode({ skipConfirm: true });
      }
    }
  });
});

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
    // The panel editor is code split, so editPanel lands in a follow-up state update.
    await waitFor(() => expect(editedPanelKey(scene)).toBe('panel-2'));
    expect(editorIsAttached(scene)).toBe(true);
  });

  it('recovers the pane when a second rebuild lands during the library-panel wait', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-2');

    await applySpec(scene, makeSpec());
    const stale = getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!;
    // The pending editor's URL key must survive even though its pane is not available yet.
    await applySpec(scene, makeSpec());
    expect(editedPanelKey(scene)).toBeUndefined();

    // Completing the discarded tree's load must not reopen an editor attached to it.
    stale.setState({ isLoaded: true });
    expect(editedPanelKey(scene)).toBeUndefined();

    getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!.setState({ isLoaded: true });
    await waitFor(() => expect(editedPanelKey(scene)).toBe('panel-2'));
    expect(editorIsAttached(scene)).toBe(true);
  });

  it.each(['library fetch', 'editor bundle'])(
    'does not restore a pending %s loader on undo and reopens on redo',
    async (phase) => {
      const scene = buildScene(makeSpec());
      scene.onEnterEditMode();
      const originalBody = scene.state.body;
      const ready = createDeferred<void>();
      const original = dashboardViews.editPanel;
      const loadEditor = jest.spyOn(dashboardViews, 'editPanel').mockImplementation((...args) => {
        const view = original(...args);
        return {
          ...view,
          load: async (signal) => {
            await ready.promise;
            return view.load(signal);
          },
        };
      });
      const key = phase === 'library fetch' ? 'panel-2' : 'panel-1';
      try {
        scene.urlSync!.updateFromUrl({ editPanel: key });
        expect(scene.state.loadingView).toBe('editPanel');
        await applySpec(scene, makeSpec());
        if (phase === 'library fetch') {
          getLibraryPanelBehavior(findVizPanelByKey(scene, key)!)!.setState({ isLoaded: true });
        }
        ready.resolve();
        await waitFor(() => expect(editedPanelKey(scene)).toBe(key));
        expect(editorIsAttached(scene)).toBe(true);

        scene.state.sidebar.undoAction();
        expect(scene.state.body === originalBody).toBe(true);
        expect(scene.state.loadingView).toBeUndefined();
        expect(editedPanelKey(scene)).toBeUndefined();

        scene.state.sidebar.redoAction();
        await waitFor(() => expect(editedPanelKey(scene)).toBe(key));
        expect(editorIsAttached(scene)).toBe(true);
        expect(scene.state.loadingView).toBeUndefined();
      } finally {
        ready.resolve();
        scene.cancelPendingViews();
        loadEditor.mockRestore();
      }
    }
  );

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

    await waitFor(() => expect(editedPanelKey(scene)).toBe('panel-2'));
    expect(editorIsAttached(scene)).toBe(true);
  });

  it('leaves a panel the user opened during the library-panel wait alone', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-2');

    await applySpec(scene, makeSpec());
    expect(editedPanelKey(scene)).toBeUndefined();

    // The pane is closed for the whole wait, so the user is free to open something else.
    openPanelEdit(scene, 'panel-1');
    getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!.setState({ isLoaded: true });

    expect(editedPanelKey(scene)).toBe('panel-1');
  });

  it('leaves the pane closed when the user exits edit mode during the library-panel wait', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-2');

    await applySpec(scene, makeSpec());
    scene.exitEditMode({ skipConfirm: true });
    getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!.setState({ isLoaded: true });

    expect(editedPanelKey(scene)).toBeUndefined();
  });

  it('keeps `?editPanel=` in the URL while the library panel loads', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-2');

    await applySpec(scene, makeSpec());

    // The pane is closed, but the dashboard is still editing that panel: a reload here has to come
    // back to it, and a load that never completes must not lose it either.
    expect(editedPanelKey(scene)).toBeUndefined();
    expect(scene.urlSync!.getUrlState().editPanel).toBe('2');

    getLibraryPanelBehavior(findVizPanelByKey(scene, 'panel-2')!)!.setState({ isLoaded: true });
    expect(scene.urlSync!.getUrlState().editPanel).toBe('2');
  });

  it('drops `?editPanel=` when the applied spec no longer has the panel', async () => {
    const scene = buildScene(makeSpec());
    openPanelEdit(scene, 'panel-1');
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await applySpec(scene, makeSpec(withoutPanel1));

    expect(scene.urlSync!.getUrlState().editPanel).toBeUndefined();
  });

  it('leaves the editor closed when none was open', async () => {
    const scene = buildScene(makeSpec());

    expect((await applySpec(scene, makeSpec())).success).toBe(true);

    expect(editedPanelKey(scene)).toBeUndefined();
  });
});

describe('APPLY_SPEC with a GroupByVariable', () => {
  const adhoc = {
    kind: 'AdhocVariable',
    group: 'prometheus',
    datasource: { name: 'prom' },
    spec: { name: 'filters', baseFilters: [], filters: [], defaultKeys: [] },
  } as unknown as VariableKind;

  const groupBy = {
    kind: 'GroupByVariable',
    group: 'prometheus',
    datasource: { name: 'prom' },
    spec: { name: 'groupBy', current: { text: ['job'], value: ['job'] } },
  } as unknown as VariableKind;

  beforeEach(() => {
    setTestFlags({ dashboardNewLayouts: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it.each([false, true])(
    'rejects a dashboard-level one with its replacement and leaves the dashboard unchanged (validate: %s)',
    async (validate) => {
      const scene = buildScene(makeSpec());
      const before = await readSpec(scene);

      const result = await applySpec(
        scene,
        makeSpec((spec) => {
          spec.variables = [adhoc, groupBy];
        }),
        validate
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Validation failed: variables.1.kind: GroupByVariable is no longer supported. Use an AdhocVariable with spec.enableGroupBy: true'
      );
      expect(await readSpec(scene)).toEqual(before);
    }
  );

  it.each([false, true])(
    'rejects a row-level one and leaves the dashboard unchanged (validate: %s)',
    async (validate) => {
      const scene = buildScene(makeSpec());
      const before = await readSpec(scene);

      const result = await applySpec(
        scene,
        makeSpec((spec) => {
          spec.layout = {
            kind: 'RowsLayout',
            spec: { rows: [{ kind: 'RowsLayoutRow', spec: { layout: spec.layout, variables: [adhoc, groupBy] } }] },
          };
        }),
        validate
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Validation failed: layout.spec.rows.0.spec.variables.1.kind: GroupByVariable is no longer supported.'
      );
      expect(await readSpec(scene)).toEqual(before);
    }
  );

  it('names every one, at dashboard and section level, in a single error', async () => {
    const scene = buildScene(makeSpec());

    const result = await applySpec(
      scene,
      makeSpec((spec) => {
        spec.variables = [groupBy];
        spec.layout = {
          kind: 'TabsLayout',
          spec: { tabs: [{ kind: 'TabsLayoutTab', spec: { layout: spec.layout, variables: [groupBy] } }] },
        };
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Validation failed: variables.0.kind, layout.spec.tabs.0.spec.variables.0.kind: GroupByVariable is no longer supported.'
    );
  });

  it.each([false, true])(
    'applies the replacement the error names: an AdhocVariable with group by enabled and a groupBy filter (validate: %s)',
    async (validate) => {
      const scene = buildScene(makeSpec());
      const replacement = {
        ...adhoc,
        spec: { ...adhoc.spec, enableGroupBy: true, filters: [{ key: 'job', operator: 'groupBy', value: '' }] },
      } as unknown as VariableKind;

      const result = await applySpec(
        scene,
        makeSpec((spec) => {
          spec.variables = [replacement];
        }),
        validate
      );

      expect(result.success).toBe(true);
      const { variables } = await readSpec(scene);
      expect(variables.map((variable) => variable.kind)).toEqual(['AdhocVariable']);
      expect(variables[0].spec).toMatchObject({
        enableGroupBy: true,
        filters: [expect.objectContaining({ key: 'job', operator: 'groupBy', value: '' })],
      });
    }
  );
});

describe('APPLY_SPEC with a user-set transformation refId', () => {
  function withTransformationRefId(spec: DashboardV2Spec) {
    transformationsOf(spec)[0].spec.refId = 'T1';
  }

  function transformationsOf(spec: DashboardV2Spec) {
    const panel = spec.elements['panel-1'];
    if (panel.kind !== 'Panel') {
      throw new Error('expected panel-1 to be a Panel');
    }
    return panel.spec.data.spec.transformations;
  }

  it('round-trips refId through a validated apply and a read back', async () => {
    const scene = buildScene(makeSpec());

    expect((await applySpec(scene, makeSpec(withTransformationRefId), true)).success).toBe(true);

    expect(transformationsOf(await readSpec(scene))[0].spec.refId).toBe('T1');
  });

  it('leaves refId unset when the applied spec has none', async () => {
    const scene = buildScene(makeSpec());

    expect((await applySpec(scene, makeSpec(), true)).success).toBe(true);

    expect(transformationsOf(await readSpec(scene))[0].spec.refId).toBeUndefined();
  });
});

describe('APPLY_SPEC keeps the rebuilt layout draggable', () => {
  // Regression: the rebuild swaps in a freshly-deserialized layout manager whose grid is not
  // draggable/resizable by default. Only the pre-rebuild body ever got `editModeChanged(true)`
  // (via entering edit mode), so panels stayed frozen in the new tree until the command also
  // called it on the swapped-in body.
  function isDraggable(scene: DashboardScene) {
    return (scene.state.body as DefaultGridLayoutManager).state.grid.state.isDraggable;
  }

  it('when the scene enters edit mode as part of applying the spec', async () => {
    const scene = buildScene(makeSpec());
    expect(scene.state.isEditing).toBeFalsy();

    expect((await applySpec(scene, makeSpec())).success).toBe(true);
    await waitFor(() => expect(isDraggable(scene)).toBe(true));
  });

  it('when the scene was already in edit mode before applying the spec', async () => {
    const scene = buildScene(makeSpec());
    scene.onEnterEditMode();

    expect((await applySpec(scene, makeSpec())).success).toBe(true);
    await waitFor(() => expect(isDraggable(scene)).toBe(true));
  });
});

describe('mutation API history of APPLY_SPEC edits', () => {
  const titled = (title: string) =>
    makeSpec((spec) => {
      spec.title = title;
    });

  const applyTitle = (scene: DashboardScene, title: string) => applySpec(scene, titled(title));
  const userEdit = (scene: DashboardScene, title: string) =>
    applyDashboardSpec({ scene, spec: titled(title), description: 'Code pane edit', scope: 'code' });

  const startBatch = (scene: DashboardScene) =>
    startBatchCommand.handler({ description: 'Assistant dashboard changes' }, { scene });
  const endBatch = (scene: DashboardScene) => endBatchCommand.handler({}, { scene });
  /** Starts a batch and returns the id START_BATCH named it with. */
  const startNamedBatch = async (scene: DashboardScene) => {
    const { data } = await startBatch(scene);
    return (data as { batchId?: string } | undefined)?.batchId;
  };
  const lastAction = async (scene: DashboardScene) => (await getLastActionCommand.handler({}, { scene })).data;
  const undo = (scene: DashboardScene) => undoCommand.handler({ expectedActor: 'mutation-api' }, { scene });
  const redo = (scene: DashboardScene) => redoCommand.handler({ expectedActor: 'mutation-api' }, { scene });

  afterEach(() => {
    setTestFlags({});
  });

  it('collects the applies of a batch into one entry that undoes and redoes as a whole', async () => {
    const scene = buildScene(titled('Before'));
    await startBatch(scene);
    await applyTitle(scene, 'First');
    await applyTitle(scene, 'Second');
    await endBatch(scene);

    expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
    expect((await undo(scene)).data).toEqual({ undone: true });
    expect((await readSpec(scene)).title).toBe('Before');

    expect((await redo(scene)).data).toEqual({ redone: true });
    expect((await readSpec(scene)).title).toBe('Second');
  });

  // Every batch has the same actor and description; its id tells its caller's entries apart.
  it('names each batch, and reports the name with the entry it became', async () => {
    const scene = buildScene(titled('Before'));
    const first = await startNamedBatch(scene);
    await applyTitle(scene, 'First');
    await endBatch(scene);
    const second = await startNamedBatch(scene);
    await applyTitle(scene, 'Second');
    await endBatch(scene);

    expect(first).toEqual(expect.any(String));
    expect(second).not.toBe(first);
    expect(await lastAction(scene)).toEqual({
      action: { description: 'Assistant dashboard changes', actor: 'mutation-api', batchId: second },
      undoneAction: null,
    });
  });

  it("refuses to undo or redo another batch's entry, once the dashboard's own Undo moved the history", async () => {
    const scene = buildScene(titled('Before'));
    const first = await startNamedBatch(scene);
    await applyTitle(scene, 'First');
    await endBatch(scene);
    const second = await startNamedBatch(scene);
    await applyTitle(scene, 'Second');
    await endBatch(scene);
    // The user steps back from the dashboard's own controls: the first batch is now newest.
    scene.state.sidebar.undoAction();

    const undoSecond = await undoCommand.handler({ expectedActor: 'mutation-api', expectedBatchId: second }, { scene });
    expect(undoSecond.success).toBe(false);
    expect((await readSpec(scene)).title).toBe('First');

    expect((await undoCommand.handler({ expectedBatchId: first }, { scene })).data).toEqual({ undone: true });
    expect((await readSpec(scene)).title).toBe('Before');
    expect((await redoCommand.handler({ expectedBatchId: second }, { scene })).success).toBe(false);
    expect((await redoCommand.handler({ expectedBatchId: first }, { scene })).data).toEqual({ redone: true });
  });

  // A multi-panel delete batches its own edits: it joins the Assistant's batch instead of replacing it.
  it("keeps the Assistant's batch when a batch of user edits starts inside it", async () => {
    const scene = buildScene(titled('Before'));
    const batchId = await startNamedBatch(scene);
    await applyTitle(scene, 'First');
    startEditBatch(scene, 'Remove panels', { actionId: 'panel.remove' });
    userEdit(scene, 'User edit');
    endEditBatch(scene);
    await applyTitle(scene, 'Second');
    await endBatch(scene);

    expect(scene.state.sidebar.state.undoStack).toHaveLength(1);
    expect(await lastAction(scene)).toEqual({
      action: { description: 'Assistant dashboard changes', actor: 'mutation-api', batchId },
      undoneAction: null,
    });
    expect((await undoCommand.handler({ expectedBatchId: batchId }, { scene })).data).toEqual({ undone: true });
    expect((await readSpec(scene)).title).toBe('Before');
    expect((await redoCommand.handler({ expectedBatchId: batchId }, { scene })).data).toEqual({ redone: true });
    expect((await readSpec(scene)).title).toBe('Second');
  });

  it('adds no entry for a batch without edits', async () => {
    const scene = buildScene(titled('Before'));
    await startBatch(scene);
    await endBatch(scene);

    expect(scene.state.sidebar.state.undoStack).toHaveLength(0);
  });

  it('reports the actor of the newest undo and undone entries', async () => {
    const scene = buildScene(titled('Before'));
    await applyTitle(scene, 'Assistant edit');
    userEdit(scene, 'User edit');
    scene.state.sidebar.undoAction();

    expect(await lastAction(scene)).toEqual({
      action: { description: 'Assistant schema edit', actor: 'mutation-api' },
      undoneAction: { description: 'Code pane edit', actor: undefined },
    });
  });

  it('refuses to undo when a user edit sits on top', async () => {
    const scene = buildScene(titled('Before'));
    await applyTitle(scene, 'Assistant edit');
    userEdit(scene, 'User edit');

    expect((await undo(scene)).success).toBe(false);
    expect((await readSpec(scene)).title).toBe('User edit');
    expect(scene.state.sidebar.state.undoStack).toHaveLength(2);
  });

  it('refuses to redo a user edit, and redoes nothing once a new edit cleared the redo history', async () => {
    const scene = buildScene(titled('Before'));
    enterEditModeIfNeeded(scene);
    userEdit(scene, 'User edit');
    scene.state.sidebar.undoAction();
    expect((await redo(scene)).success).toBe(false);

    await applyTitle(scene, 'Assistant edit');
    await undo(scene);
    userEdit(scene, 'Another user edit');
    expect((await redo(scene)).data).toEqual({ redone: false });
    expect((await readSpec(scene)).title).toBe('Another user edit');
  });

  it('reports undo and redo it runs as triggered by the mutation API', async () => {
    const scene = buildScene(titled('Before'));
    await applyTitle(scene, 'After');
    jest.mocked(reportInteraction).mockClear();

    await undo(scene);
    await redo(scene);

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_dashboard_undo',
      expect.objectContaining({ scope: 'mutation-api', trigger: 'mutation-api' })
    );
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_dashboard_redo',
      expect.objectContaining({ scope: 'mutation-api', trigger: 'mutation-api' })
    );
  });

  it('undoes an Assistant edit made while the dashboard shows the agent presentation', async () => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
    const scene = buildScene(titled('Before'));
    scene.onEnterEditMode();
    scene.setDashboardMode('view');

    try {
      await scene.withAssistantWrite(() => applyTitle(scene, 'After'));
      expect(scene.state.mode).toBe('agent');

      expect((await undo(scene)).data).toEqual({ undone: true });
      expect((await readSpec(scene)).title).toBe('Before');
    } finally {
      scene.exitEditMode({ skipConfirm: true });
    }
  });
});

describe('coauthoring Accept and Assistant checkpoint history', () => {
  it.each([
    'closed',
    'open',
    'nested',
    'redo',
    'unrelated',
    'older-panel',
    'older-open',
    'older-nested',
    'redo-panel',
    'detached',
    'blocked',
    'no-activation',
  ])('protects query ownership across %s history', async (mode) => {
    const openDuringAccept = ['open', 'nested', 'older-open', 'older-nested'].includes(mode);
    setTestFlags({ dashboardNewLayouts: true });
    cachedPanelPlugin = getPanelPlugin({ id: 'timeseries' });
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
    setRunRequest((_ds, request) => of({ request, state: LoadingState.Done, series: [], timeRange: request.range }));
    const scene = buildScene(makeSpec());
    const stop = scene.activate();
    const detachSidebarView = mode === 'detached' ? scene.state.sidebar.activate() : () => {};
    let engine: QueryCoauthoringSessionEngine | undefined;
    try {
      const firstPanel = findVizPanelByKey(scene, 'panel-1')!;
      getQueryRunnerFor(firstPanel)!.setState({
        queries: [{ refId: 'A', type: 'math', expression: '1', datasource: { uid: '__expr__', type: '__expr__' } }],
      });
      enterEditModeIfNeeded(scene);
      if (['older-panel', 'older-open', 'older-nested'].includes(mode)) {
        const stopPanel = firstPanel.activate();
        await waitFor(() => expect(firstPanel.getPlugin()?.meta.id).toBe('timeseries'));
        changeViewPanelOptions(firstPanel, { ...firstPanel.state.options, bars: true }, 'Bars', 'Display');
        stopPanel();
      }
      const before = await readSpec(scene);

      const { data } = await startBatchCommand.handler({ description: 'Assistant dashboard changes' }, { scene });
      const batchId = (data as { batchId: string }).batchId;
      if (mode === 'nested' || mode === 'older-nested') {
        await startBatchCommand.handler({ description: 'Nested schema changes' }, { scene });
      }
      await applySpec(scene, { ...before, title: 'Assistant title' });
      if (!openDuringAccept) {
        await endBatchCommand.handler({}, { scene });
      }
      if (mode === 'redo-panel') {
        const changedPanel = findVizPanelByKey(scene, 'panel-1')!;
        const stopPanel = changedPanel.activate();
        await waitFor(() => expect(changedPanel.getPlugin()?.meta.id).toBe('timeseries'));
        changeViewPanelOptions(changedPanel, { ...changedPanel.state.options, bars: true }, 'Bars', 'Display');
        scene.state.sidebar.undoLastAction();
        stopPanel();
      }
      if (mode === 'redo' || mode === 'redo-panel') {
        expect(
          (await undoCommand.handler({ expectedActor: 'mutation-api', expectedBatchId: batchId }, { scene })).data
        ).toEqual({ undone: true });
      }
      if (mode === 'unrelated') {
        edit({
          source: scene,
          meta: { actionId: 'dashboard.changeDescription' },
          perform: () => scene.setState({ description: 'Standalone edit' }),
          undo: () => scene.setState({ description: 'Restored standalone' }),
        });
      }
      const panel = openPanelEdit(scene, 'panel-1');
      const runner = getQueryRunnerFor(panel)!;
      setRunRequest((_ds, request) => of({ request, state: LoadingState.Done, series: [], timeRange: request.range }));
      engine = QueryCoauthoringSessionEngine.getOrCreate(panel);
      const session = engine.enter('A', [], undefined, undefined, {
        refId: 'A',
        revision: engine.getRevision(),
        contextGeneration: engine.getContextGeneration(),
        ranges: [],
        status: 'ready',
        text: '1',
      });
      if (mode === 'blocked') {
        setRunRequest((_ds, request) =>
          of({
            request,
            state: LoadingState.Error,
            series: [],
            timeRange: request.range,
            error: { refId: 'A', message: 'Preview rejected' },
          })
        );
      }
      const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: '2' }] }], {
        baseRevision: session.getState().revision,
        baseContextGeneration: session.getState().contextGeneration,
      });
      expect(result.status).toBe('staged');
      if (result.status !== 'staged') {
        throw new Error('Expected staged');
      }
      detachSidebarView();
      if (mode === 'blocked' || mode === 'no-activation') {
        if (mode === 'blocked') {
          await waitFor(() => expect(session.getState().proposal?.[0].previewOutcome).toBe('error'));
        } else {
          Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false } });
        }
        expect(await session.accept(result.id, { baseRevision: session.getState().revision })).toEqual({
          status: mode === 'blocked' ? 'blocked' : 'no_user_activation',
        });
        expect((await getLastActionCommand.handler({}, { scene })).data).toMatchObject({ action: { batchId } });
        expect(runner.state.queries[0]).toMatchObject({ expression: '1' });
        return;
      }
      expect(await session.accept(result.id, { baseRevision: session.getState().revision })).toMatchObject({
        status: 'applied',
      });
      const accepted = await readSpec(scene);
      expect(accepted.elements['panel-1']).not.toEqual(before.elements['panel-1']);
      expect(runner.state.queries[0]).toMatchObject({ expression: '2' });
      if (openDuringAccept) {
        await endBatchCommand.handler({}, { scene });
      }
      if (mode === 'nested' || mode === 'older-nested') {
        await endBatchCommand.handler({}, { scene });
      }
      const undone = await undoCommand.handler({ expectedActor: 'mutation-api', expectedBatchId: batchId }, { scene });
      expect((await readSpec(scene)).elements['panel-1']).toEqual(accepted.elements['panel-1']);
      if (mode === 'unrelated') {
        expect(undone.success).toBe(false);
        scene.state.sidebar.undoLastAction();
        expect(scene.state.description).toBe('Restored standalone');
      } else {
        expect(undone).toMatchObject({ success: true, data: { undone: false } });
      }
      if (mode === 'redo' || mode === 'redo-panel') {
        expect(
          await redoCommand.handler({ expectedActor: 'mutation-api', expectedBatchId: batchId }, { scene })
        ).toMatchObject({ success: true, data: { redone: false } });
      }
      expect(getQueryRunnerFor(findVizPanelByKey(scene, 'panel-1')!)!.state.queries[0]).toMatchObject({
        expression: '2',
      });
      expect(session.signal.aborted).toBe(false);
      expect(await session.undo({})).toMatchObject({ status: 'applied' });
      expect(runner.state.queries[0]).toMatchObject({ expression: '1' });
    } finally {
      engine?.dispose();
      stop();
      setTestFlags({});
    }
  });
});

describe('Coauthoring Accept and server reload admission', () => {
  it.each([false, true])('keeps an accepted Panel Edit query unsaved with plugin history=%s', async (pluginHistory) => {
    setTestFlags({ dashboardNewLayouts: true, 'assistant.dashboard.artifacts': true });
    cachedPanelPlugin = getPanelPlugin({ id: 'timeseries' });
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
    setRunRequest((_ds, request) => of({ request, state: LoadingState.Done, series: [], timeRange: request.range }));
    const saved = makeSpec((spec) => {
      const panel = spec.elements['panel-1'];
      if (panel.kind !== 'Panel') {
        throw new Error('Expected Panel');
      }
      panel.spec.data.spec.queries[0].spec.query = {
        kind: 'DataQuery',
        group: '__expr__',
        version: 'v0',
        datasource: { name: '__expr__' },
        spec: { type: 'math', expression: '1' },
      };
    });
    const scene = buildScene(saved);
    const uid = scene.state.uid!;
    const history = {
      record: jest.fn(async () => ({ recorded: true })),
      undo: jest.fn(),
      redo: jest.fn(),
      getState: () => ({ proposed: saved }),
      subscribe: () => () => {},
    } satisfies PendingChangesHistory;
    if (pluginHistory) {
      jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
      jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
        addedFunctionsRegistry: {
          getState: async () => ({
            'grafana/dashboard/pending-changes/v1': [
              { fn: async () => ({ baseGeneration: 1, proposed: saved, history }) },
            ],
          }),
        },
      } as unknown as Awaited<ReturnType<typeof getPluginExtensionRegistries>>);
      await loadPendingChangePreview('page', uid, 'chat-reload');
      expect(getPendingChangesHistory(scene.state)).toBe(history);
    }
    const stop = scene.activate();
    let engine: QueryCoauthoringSessionEngine | undefined;
    const reload = jest.fn(async () => {
      swapInReloadedDashboard(scene, buildScene(saved));
      return true;
    });
    setPendingChangesPageReload(reload);
    try {
      const panel = openPanelEdit(scene, 'panel-1');
      const runner = getQueryRunnerFor(panel)!;
      engine = QueryCoauthoringSessionEngine.getOrCreate(panel);
      const session = engine.enter('A', [], undefined, undefined, {
        refId: 'A',
        revision: engine.getRevision(),
        contextGeneration: engine.getContextGeneration(),
        ranges: [],
        status: 'ready',
        text: '1',
      });
      const [option] = await session.stageProposal([{ changes: [{ refId: 'A', text: '2' }] }], {
        baseRevision: session.getState().revision,
        baseContextGeneration: session.getState().contextGeneration,
      });
      if (option.status !== 'staged') {
        throw new Error(option.status);
      }
      expect(await session.accept(option.id, { baseRevision: session.getState().revision })).toMatchObject({
        status: 'applied',
      });
      const accepted = (await readSpec(scene)).elements['panel-1'];
      expect(runner.state.queries[0]).toMatchObject({ expression: '2' });
      const result = await dashboardMutationApi.execute({
        type: 'RELOAD_FROM_SERVER',
        payload: { pendingChanges: null },
      });
      expect((await readSpec(scene)).elements['panel-1']).toEqual(accepted);
      expect(result).toMatchObject({ success: true, data: { reloaded: false, reason: 'unsaved-changes' } });
      expect(reload).toHaveBeenCalledTimes(0);
      expect(getQueryRunnerFor(findVizPanelByKey(scene, 'panel-1')!)!.state.queries[0]).toMatchObject({
        expression: '2',
      });
      expect(editorIsAttached(scene)).toBe(true);
      expect(session.signal.aborted).toBe(false);
      expect(history.record).toHaveBeenCalledTimes(0);
      const beforeSwitch = locationService.getLocation().search;
      expect(
        await dashboardMutationApi.execute({ type: 'RELOAD_FROM_SERVER', payload: { pendingChanges: 'other-chat' } })
      ).toMatchObject({ success: true, data: { reloaded: false, reason: 'unsaved-changes' } });
      expect(locationService.getLocation().search).toBe(beforeSwitch);
      expect(await session.undo({})).toMatchObject({ status: 'applied' });
      expect(runner.state.queries[0]).toMatchObject({ expression: '1' });
      expect(
        await dashboardMutationApi.execute({ type: 'RELOAD_FROM_SERVER', payload: { pendingChanges: null } })
      ).toMatchObject({ success: true, data: { reloaded: true } });
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      engine?.dispose();
      stop();
      clearPendingChangePreview(uid, 'chat-reload');
      setPendingChangesPageReload(async () => false);
      locationService.replace('/');
      setTestFlags({});
    }
  });
});
