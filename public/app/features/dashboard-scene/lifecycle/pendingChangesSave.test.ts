import { waitFor } from '@testing-library/react';

import {
  defaultPanelKind,
  defaultSpec,
  type Spec as DashboardV2Spec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type DashboardScene } from '../scene/DashboardScene';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';

import {
  clearPendingChangePreview,
  type DashboardPendingChanges,
  getScenePendingChangePreview,
  loadPendingChangePreview,
} from './pendingChangePreview';
import { pendingChangesRecorded, recordPendingChange } from './pendingChangesHistory';
import { setPendingChangesPageClose, takeEditingOnNextLoad } from './pendingChangesPageReload';
import {
  discardScenePendingChanges,
  getPendingChangesDiff,
  openPendingChangesForEditing,
  savePendingChanges,
  withNewDashboardBaseline,
} from './pendingChangesSave';

jest.mock('app/features/plugins/extensions/registry/setup', () => ({ getPluginExtensionRegistries: jest.fn() }));
jest.mock('app/features/plugins/extensions/utils', () => ({
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));

// The plugin leaves out the empty description the saved version spells out.
const saved: DashboardV2Spec = { ...defaultSpec(), title: 'Saved', description: '' };
const proposed: DashboardV2Spec = { ...defaultSpec(), title: 'Proposed' };

const closePage = jest.fn(async (_uid: string) => undefined);
setPendingChangesPageClose(closePage);

function pendingChanges(overrides: Partial<DashboardPendingChanges> = {}): DashboardPendingChanges {
  return {
    baseGeneration: 3,
    proposed,
    apply: jest.fn(async () => ({ applied: true as const })),
    discard: jest.fn(async () => undefined),
    history: {
      record: jest.fn(async () => ({ recorded: true })),
      undo: jest.fn(),
      redo: jest.fn(),
      getState: () => ({}),
      subscribe: () => () => {},
    },
    ...overrides,
  };
}

/** The page's preview of `pending`, as their plugin's loader supplies them. */
async function loadOnPage(pending: DashboardPendingChanges) {
  jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
  jest.mocked(getAppPluginConfigs).mockResolvedValue([]);
  jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
    addedFunctionsRegistry: {
      getState: async () => ({ 'grafana/dashboard/pending-changes/v1': [{ fn: async () => pending }] }),
    },
  } as unknown as Awaited<ReturnType<typeof getPluginExtensionRegistries>>);
  return loadPendingChangePreview('page', 'dash-1', 'chat-1');
}

/** The dashboard page showing a draft, `pending` to version 0, as the page loads it. */
async function openDraftOnPage(pending: DashboardPendingChanges, newDashboard: DashboardV2Spec) {
  const preview = await loadOnPage(pending);
  preview!.newDashboard = newDashboard;
  const scene = transformSaveModelSchemaV2ToScene({
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: '', generation: 0, resourceVersion: '', creationTimestamp: '', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: false, canAdmin: true },
    spec: structuredClone(pending.proposed),
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>);
  scene.setState({ meta: { ...scene.state.meta, newDashboardUid: 'dash-1' } });
  return scene;
}

/** The dashboard page showing `pending` to a dashboard saved at generation 3, as the page loads it. */
async function openOnPage(pending: DashboardPendingChanges, savedSpec = saved): Promise<DashboardScene> {
  const preview = await loadOnPage(pending);
  preview!.saved = { spec: savedSpec, generation: 3 };
  const scene = transformSaveModelSchemaV2ToScene({
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 3, resourceVersion: '3', creationTimestamp: '', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: false, canAdmin: true },
    spec: structuredClone(pending.proposed),
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>);
  openPendingChangesForEditing(scene);
  return scene;
}

beforeEach(() => {
  setTestFlags({ 'assistant.dashboard.artifacts': true, dashboardNewLayouts: true });
  closePage.mockClear();
});

afterEach(() => {
  clearPendingChangePreview('dash-1', 'chat-1');
  takeEditingOnNextLoad('dash-1');
  setTestFlags({});
});

describe('opening pending changes on the page', () => {
  it('opens them in edit mode, as unsaved changes to the saved version', async () => {
    const scene = await openOnPage(pendingChanges());

    expect(scene.state.isEditing).toBe(true);
    // The title changed; the description is empty on both sides however each spells it.
    const changes = getPendingChangesDiff(scene);
    expect(changes?.diffCount).toBe(1);
    expect(Object.keys(changes?.diffs ?? {})).toEqual(['title']);
  });

  it('measures the changes in the form the dashboard writes, so key order and defaults left out are no change', async () => {
    const code = { language: 'plaintext', showLineNumbers: false, showMiniMap: false };
    const textPanel = (title: string, version: string, options: Record<string, unknown>) => ({
      kind: 'Panel',
      spec: {
        ...defaultPanelKind().spec,
        id: 5,
        title,
        vizConfig: {
          kind: 'VizConfig',
          group: 'text',
          version,
          spec: { options, fieldConfig: { defaults: {}, overrides: [] } },
        },
      },
    });
    const layout = {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: 'p5' } },
          },
        ],
      },
    };
    const { title: _, ...rest } = defaultSpec();
    // As Grafana saved it: keys sorted, with the panel version and the text options it fills in.
    const savedSpec = sortedDeepCloneWithoutNulls({
      ...rest,
      title: 'DOM TEST',
      elements: { p5: textPanel('666', '13.3.0', { code, content: 'Panel 666', mode: 'markdown' }) },
      layout,
    }) as unknown as DashboardV2Spec;
    // As the Assistant left it: the title first, and the panel it rewrote without them.
    const proposed = {
      title: 'DOM TEST',
      ...rest,
      elements: { p5: textPanel('5', '', { content: 'Panel 5', mode: 'markdown' }) },
      layout,
    } as unknown as DashboardV2Spec;
    const scene = await openOnPage(pendingChanges({ proposed }), savedSpec);
    // The panel's plugin loading fills them in again.
    const [panel] = scene.state.body.getVizPanels();
    panel.setState({ pluginVersion: '13.3.0', options: { ...panel.state.options, code } });

    const changes = getPendingChangesDiff(scene)!;

    expect(Object.keys(changes.diffs)).toEqual(['elements']);
    expect(changes.diffs.elements.map((diff) => diff.path.at(-1)).sort()).toEqual(['content', 'title']);
    expect(Object.keys(changes.initialSaveModel)).toEqual(Object.keys(changes.changedSaveModel));
  });

  it('records an edit not recorded yet as the save drawer opens, so its changes include it', async () => {
    let recorded: DashboardV2Spec | undefined;
    const pending = pendingChanges();
    pending.history = {
      ...pending.history!,
      record: jest.fn(async ({ proposed }) => {
        recorded = proposed;
        return { recorded: true };
      }),
      getState: () => ({ proposed: recorded }),
    };
    const scene = await openOnPage(pending);
    // The description is the same in the saved version and the pending changes: only this edit changes it.
    scene.setState({ description: 'Edited by hand', isDirty: true });

    void scene.openSaveDrawer({});
    await pendingChangesRecorded(scene);

    expect(pending.history.record).toHaveBeenCalledTimes(1);
    expect(Object.keys(getPendingChangesDiff(scene)!.diffs)).toContain('description');
  });

  it('leaves them read-only when their plugin keeps no history to record edits in', async () => {
    const scene = await openOnPage(pendingChanges({ history: undefined }));

    expect(scene.state.title).toBe('Proposed');
    expect(Boolean(scene.state.isEditing)).toBe(false);
  });
});

describe('saving pending changes', () => {
  it('saves them through their plugin with the message for version history, then forgets them', async () => {
    const pending = pendingChanges();
    const scene = await openOnPage(pending);

    await expect(savePendingChanges(scene, { force: false, message: 'Tidy up' })).resolves.toEqual({ saved: true });

    expect(pending.apply).toHaveBeenCalledWith({ force: false, message: 'Tidy up' });
    expect(getScenePendingChangePreview(scene.state)).toBeUndefined();
  });

  it('reports the version someone else saved since, and keeps the pending changes', async () => {
    const pending = pendingChanges({ apply: jest.fn(async () => ({ applied: false as const, currentGeneration: 5 })) });
    const scene = await openOnPage(pending);

    await expect(savePendingChanges(scene, { force: false, message: '' })).resolves.toEqual({
      saved: false,
      currentGeneration: 5,
    });
    expect(getScenePendingChangePreview(scene.state)?.id).toBe('chat-1');
  });
});

describe('discarding pending changes', () => {
  it('asks on Exit edit while an edit is on its way, even when the recorded changes match the saved version', async () => {
    const pending = pendingChanges({ proposed: { ...defaultSpec(), title: 'Saved' } });
    pending.history!.record = jest.fn(() => new Promise<{ recorded: boolean }>(() => {}));
    const scene = await openOnPage(pending);
    const modals: ShowConfirmModalEvent[] = [];
    const subscription = appEvents.subscribe(ShowConfirmModalEvent, (event) => modals.push(event));
    scene.setState({ title: 'Edited', isDirty: true });

    scene.exitEditMode({ skipConfirm: false });

    expect(modals.map((modal) => modal.payload.title)).toEqual(['Unsaved changes']);
    expect(pending.discard).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('asks to save or discard them on Exit edit, as for edits made by hand, and discards them in their plugin', async () => {
    const pending = pendingChanges();
    const scene = await openOnPage(pending);
    const modals: ShowConfirmModalEvent[] = [];
    const subscription = appEvents.subscribe(ShowConfirmModalEvent, (event) => modals.push(event));

    scene.exitEditMode({ skipConfirm: false });

    expect(modals.map((modal) => modal.payload.title)).toEqual(['Unsaved changes']);
    expect(modals[0].payload.altActionText).toBe('Save');
    expect(scene.state.isEditing).toBe(true);

    modals[0].payload.onConfirm?.();
    await waitFor(() => expect(closePage).toHaveBeenCalledWith('dash-1'));
    expect(pending.discard).toHaveBeenCalledTimes(1);
    expect(scene.state.isEditing).toBe(false);
    expect(takeEditingOnNextLoad('dash-1')).toBe(false);
    subscription.unsubscribe();
  });

  it('discards once an edit on its way reached the plugin, so it cannot bring the changes back', async () => {
    const order: string[] = [];
    let finishRecording = () => {};
    const pending = pendingChanges({ discard: jest.fn(async () => void order.push('discard')) });
    pending.history!.record = jest.fn(() => {
      order.push('record');
      return new Promise<{ recorded: boolean }>((resolve) => {
        finishRecording = () => resolve({ recorded: true });
      });
    });
    const scene = await openOnPage(pending);
    scene.setState({ title: 'Edited' });
    void recordPendingChange(scene, pending.history!, 'Edit dashboard');

    const discarded = discardScenePendingChanges(scene);
    await waitFor(() => expect(pending.history!.record).toHaveBeenCalledTimes(1));
    expect(pending.discard).not.toHaveBeenCalled();

    finishRecording();
    await discarded;
    expect(order).toEqual(['record', 'discard']);
  });

  it("shows a draft's changes from a blank dashboard, as for one made from scratch, and saves the draft as it is", async () => {
    const newDashboard: DashboardV2Spec = { ...defaultSpec(), title: 'New dashboard' };
    const scene = await openDraftOnPage(pendingChanges({ baseGeneration: 0 }), newDashboard);
    const changes = scene.getDashboardChanges();

    const shown = withNewDashboardBaseline(scene, changes);

    expect(shown.initialSaveModel).toEqual(newDashboard);
    expect(Object.keys(shown.diffs)).toContain('title');
    expect(shown.changedSaveModel).toBe(changes.changedSaveModel);
  });

  it('opens the saved dashboard for editing after Discard changes, which keeps editing', async () => {
    const pending = pendingChanges();
    const scene = await openOnPage(pending);

    await discardScenePendingChanges(scene, { keepEditing: true });

    expect(pending.discard).toHaveBeenCalledTimes(1);
    expect(getScenePendingChangePreview(scene.state)).toBeUndefined();
    expect(closePage).toHaveBeenCalledWith('dash-1');
    expect(takeEditingOnNextLoad('dash-1')).toBe(true);
  });
});
