import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import {
  getEffectiveExtensionSidebarPresentation,
  notifyExtensionSidebarClosed,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { contextSrv } from 'app/core/services/context_srv';
import { composerApi } from 'app/features/plugins/components/restrictedGrafanaApis/composer/composerApi';
import { ShowConfirmModalEvent } from 'app/types/events';

import { NotebookConflictError, notebookResourceFor, updateNotebook } from '../api/notebookResource';
import { NotebookMutationClient } from '../mutation-api/NotebookMutationClient';
import { NOTEBOOKS_FLAG, notebookSpec } from '../mutation-api/test-utils';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { transformNotebookToScene } from '../serialization/transformNotebookToScene';

import { enterNotebookComposer } from './NotebookComposerDocument';
import { canEnterNotebookComposer, setRouteNotebook } from './notebookComposerAccess';

// The Assistant's sidebar: the plugin that may float.
const sidebarPresentation = () => getEffectiveExtensionSidebarPresentation('grafana-assistant-app');

// Only the network write is stubbed, so what these tests see saved is what would be sent.
jest.mock('../api/notebookResource', () => ({
  ...jest.requireActual('../api/notebookResource'),
  updateNotebook: jest.fn(),
  createNotebook: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

const COMPOSER_FLAGS = { [NOTEBOOKS_FLAG]: true, 'grafana.notebookComposer': true };
const NOTEBOOK = { resource: 'notebook' as const, uid: 'nb-1' };
/** Past autosave's longest wait (15 s), so a save that was going to happen has happened. */
const PAST_AUTOSAVE_MS = 20_000;

let cleanups: Array<() => void> = [];

beforeEach(() => {
  setTestFlags(COMPOSER_FLAGS);
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  jest.mocked(updateNotebook).mockReset().mockResolvedValue({ generation: 2, resourceVersion: '2' });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  jest.useRealTimers();
  jest.restoreAllMocks();
  resetExtensionSidebarPresentationForTests();
  setTestFlags({});
});

const deactivations = new Map<NotebookScene, () => void>();

/** An activated notebook, deactivated after the test unless the test already did (`leave`). */
function mounted(uid = 'nb-1'): NotebookScene {
  const scene = transformNotebookToScene(notebookResourceFor(uid, notebookSpec()));
  deactivations.set(scene, scene.activate());
  cleanups.push(() => leave(scene));
  return scene;
}

/** A notebook on its route, as NotebookScenePage registers it. */
function onRoute(scene = mounted()): NotebookScene {
  cleanups.push(setRouteNotebook(scene));
  return scene;
}

/** The page going away: the scene deactivates. */
function leave(scene: NotebookScene) {
  deactivations.get(scene)?.();
  deactivations.delete(scene);
}

const live = () => new AbortController().signal;

async function retitle(session: ReturnType<typeof enterNotebookComposer>, title: string) {
  const { spec, revision } = await session.readSpec();
  return session.applySpec({ ...spec, title }, { signal: live(), baseRevision: revision });
}

describe('entering Composer on a notebook', () => {
  it('is available on the notebook its route renders', () => {
    onRoute();
    expect(composerApi.canEnter(NOTEBOOK)).toEqual({ ok: true });
  });

  it('is unsupported while its toggle is off, even with notebooks on', async () => {
    onRoute();
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
    expect(composerApi.canEnter(NOTEBOOK)).toEqual({ ok: false, reason: 'unsupported' });
    await expect(composerApi.enter(NOTEBOOK, { presentation: 'none' })).rejects.toThrow('unsupported');
  });

  it('needs notebooks:write', async () => {
    const scene = onRoute();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    expect(composerApi.canEnter(NOTEBOOK)).toEqual({ ok: false, reason: 'no_permission' });
    await expect(composerApi.enter(NOTEBOOK, { presentation: 'none' })).rejects.toThrow('no_permission');
    expect(scene.state.isComposing).toBeFalsy();
  });

  it('is unsupported for a notebook drawn somewhere other than its route, such as the Assistant canvas', async () => {
    const scene = mounted();
    expect(composerApi.canEnter(NOTEBOOK)).toEqual({ ok: false, reason: 'unsupported' });
    await expect(composerApi.enter(NOTEBOOK, { presentation: 'none' })).rejects.toThrow('unsupported');
    expect(() => enterNotebookComposer(scene)).toThrow('unsupported');
  });

  it('is unsupported for a notebook that does not exist yet, and while Composer is already open', () => {
    const scene = onRoute(mounted(''));
    // `/notebooks/new` before its first save: there is nothing to save Composer's edits to yet.
    expect(canEnterNotebookComposer(scene, { onRoute: true })).toEqual({ ok: false, reason: 'unsupported' });
    expect(() => enterNotebookComposer(scene)).toThrow('unsupported');

    const saved = onRoute();
    enterNotebookComposer(saved);
    expect(composerApi.canEnter(NOTEBOOK)).toEqual({ ok: false, reason: 'unsupported' });
    expect(scene.state.isComposing).toBeFalsy();
  });

  it('finds no document for a notebook that is not mounted', () => {
    onRoute();
    expect(composerApi.canEnter({ resource: 'notebook', uid: 'elsewhere' })).toEqual({
      ok: false,
      reason: 'no_document',
    });
  });

  it('enters through the API, leaving edit mode first and hiding its chrome', async () => {
    const scene = onRoute();
    scene.onEnterEditMode();
    expect(scene.state.isEditing).toBe(true);

    const session = await composerApi.enter(NOTEBOOK, { presentation: 'none' });

    expect(session.target).toEqual(NOTEBOOK);
    expect(scene.state.isComposing).toBe(true);
    expect(scene.state.isEditing).toBe(false);
    expect(scene.state.body.state.isEditing).toBe(false);
    expect(scene.getComposerSession()).toBe(session);
  });
});

// grafana.extensionSidebarFloating is off here: the session floats the sidebar without it.
describe('the extension sidebar', () => {
  it('floats for a notebook session and goes back to docked when it ends', async () => {
    const scene = onRoute();
    const session = await composerApi.enter(NOTEBOOK);
    expect(sidebarPresentation()).toBe('floating');

    session.exit();

    expect(scene.state.isComposing).toBe(false);
    expect(sidebarPresentation()).toBe('docked');
  });

  it('keeps the notebook session open, and writing, when the user docks it', async () => {
    const scene = onRoute();
    const session = await composerApi.enter(NOTEBOOK);

    setExtensionSidebarPresentation('docked');

    expect(session.signal.aborted).toBe(false);
    expect(scene.state.isComposing).toBe(true);
    expect(sidebarPresentation()).toBe('docked');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the notebook session the API entered
    await expect(retitle(session as ReturnType<typeof enterNotebookComposer>, 'Docked')).resolves.toMatchObject({
      status: 'applied',
    });
    expect(scene.state.title).toBe('Docked');

    session.exit();
    expect(sidebarPresentation()).toBe('docked');
  });

  it("brings back the user's floating layout after a session they did not re-lay out", async () => {
    setTestFlags({ ...COMPOSER_FLAGS, 'grafana.extensionSidebarFloating': true });
    setExtensionSidebarPresentation('floating');
    onRoute();
    const session = await composerApi.enter(NOTEBOOK);

    session.exit();

    expect(sidebarPresentation()).toBe('floating');
  });

  it("keeps the user's mid-session dock after the notebook session ends", async () => {
    setTestFlags({ ...COMPOSER_FLAGS, 'grafana.extensionSidebarFloating': true });
    setExtensionSidebarPresentation('floating');
    onRoute();
    const session = await composerApi.enter(NOTEBOOK);
    setExtensionSidebarPresentation('docked');

    session.exit();

    expect(sidebarPresentation()).toBe('docked');
  });

  it('ends the notebook session when the sidebar closes', async () => {
    const scene = onRoute();
    const session = await composerApi.enter(NOTEBOOK);

    notifyExtensionSidebarClosed();

    expect(session.signal.aborted).toBe(true);
    expect(scene.state.isComposing).toBe(false);
  });

  it('goes back to docked when the notebook page goes away mid-session', async () => {
    const scene = onRoute();
    await composerApi.enter(NOTEBOOK);

    leave(scene);

    expect(sidebarPresentation()).toBe('docked');
  });
});

describe('writing', () => {
  it('applies a whole spec as one native undo step per turn', async () => {
    const scene = onRoute();
    const original = scene.state.title;
    const session = enterNotebookComposer(scene);

    const first = await retitle(session, 'First');
    const second = await retitle(session, 'Second');

    expect(first.status).toBe('applied');
    expect(second).toMatchObject({ status: 'applied', appliedSpec: expect.objectContaining({ title: 'Second' }) });
    expect(scene.state.isComposing).toBe(true);
    scene.editHistory.undo();
    expect(scene.state.title).toBe('First');
    scene.editHistory.undo();
    expect(scene.state.title).toBe(original);
    // Undo never changes the mode the scene is in.
    expect(scene.state.isComposing).toBe(true);
    expect(scene.state.isEditing).toBeFalsy();
  });

  it('refuses a write prepared against an older revision of the edit history, changing nothing', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    const applied = await retitle(session, 'Assistant');
    const { spec } = await session.readSpec();
    const revision = applied.status === 'applied' ? applied.revision : -1;

    // A native undo is a change to the document Assistant has not read.
    scene.editHistory.undo();
    const original = scene.state.title;
    const stale = await session.applySpec(
      { ...spec, title: 'From an old read' },
      { signal: live(), baseRevision: revision }
    );

    expect(stale).toMatchObject({ status: 'stale' });
    expect(scene.state.title).toBe(original);
    await expect(session.readSpec()).resolves.toMatchObject({ revision: revision + 1 });
  });

  it('does not count state changes outside the edit history, such as a time range or a query refresh', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    const { spec, revision } = await session.readSpec();

    scene.state.$timeRange.setState({ from: 'now-1h' });
    scene.forceRender();

    await expect(
      session.applySpec({ ...spec, title: 'Still current' }, { signal: live(), baseRevision: revision })
    ).resolves.toMatchObject({ status: 'applied' });
  });

  it('gates after the async prepare: a write whose session ended meanwhile changes nothing', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    const { spec, revision } = await session.readSpec();

    const pending = session.applySpec({ ...spec, title: 'Too late' }, { signal: live(), baseRevision: revision });
    session.exit();

    await expect(pending).resolves.toMatchObject({ status: 'closed' });
    expect(scene.state.title).not.toBe('Too late');
  });

  it('refuses an aborted request and an invalid spec', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    const { spec, revision } = await session.readSpec();
    const controller = new AbortController();
    controller.abort();

    await expect(
      session.applySpec({ ...spec, title: 'Stopped' }, { signal: controller.signal, baseRevision: revision })
    ).resolves.toMatchObject({ status: 'aborted' });
    await expect(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- deliberately not a spec
      session.applySpec({ title: 3 } as unknown as typeof spec, { signal: live(), baseRevision: revision })
    ).resolves.toMatchObject({ status: 'invalid' });
  });

  it('keeps the mutation API from writing around the session', async () => {
    const scene = onRoute();
    enterNotebookComposer(scene);
    const spec = { ...transformNotebookSceneToSaveModel(scene), title: 'Around Composer' };

    const result = await new NotebookMutationClient(scene).execute({ type: 'APPLY_NOTEBOOK_SPEC', payload: { spec } });

    expect(result.success).toBe(false);
    expect(scene.state.title).not.toBe('Around Composer');
    expect(scene.state.isEditing).toBeFalsy();
  });
});

describe('saving', () => {
  it('holds every save back during the session and saves exactly once on exit', async () => {
    jest.useFakeTimers();
    const scene = onRoute();
    const session = enterNotebookComposer(scene);

    await retitle(session, 'One');
    await retitle(session, 'Two');
    jest.advanceTimersByTime(PAST_AUTOSAVE_MS);
    await Promise.resolve();

    expect(updateNotebook).not.toHaveBeenCalled();
    expect(scene.autosave.state.status).toBe('pending');

    await expect(session.exit()).resolves.toEqual({ save: { status: 'saved' } });
    await expect(session.closed).resolves.toEqual({ save: { status: 'saved' } });
    jest.advanceTimersByTime(PAST_AUTOSAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateNotebook).mock.calls[0][1]).toMatchObject({ title: 'Two' });
    expect(scene.state.isComposing).toBe(false);
  });

  it('reports nothing to save when nothing was applied', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);

    await expect(session.exit()).resolves.toEqual({ save: { status: 'unchanged' } });
    expect(updateNotebook).not.toHaveBeenCalled();
  });

  it('reports a failed save with its error, and saves on retry', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    await retitle(session, 'Unsaved');
    jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('The server is down'));

    await expect(session.exit()).resolves.toEqual({
      save: { status: 'save_failed', message: 'The server is down' },
    });
    expect(scene.autosave.state.status).toBe('error');

    await expect(session.retrySave?.()).resolves.toEqual({ save: { status: 'saved' } });
    expect(updateNotebook).toHaveBeenCalledTimes(2);
  });

  it('reports a conflict and raises the notebook conflict prompt, which retrySave leaves to it', async () => {
    const scene = onRoute();
    const prompts: ShowConfirmModalEvent[] = [];
    const subscription = appEvents.subscribe(ShowConfirmModalEvent, (event) => prompts.push(event));
    cleanups.push(() => subscription.unsubscribe());
    const session = enterNotebookComposer(scene);
    await retitle(session, 'Mine');
    jest.mocked(updateNotebook).mockRejectedValueOnce(new NotebookConflictError('conflict'));

    const result = await session.exit();

    expect(result).toEqual({ save: { status: 'conflict', message: 'Someone else saved this notebook first.' } });
    expect(prompts).toHaveLength(1);
    expect(prompts[0].payload.yesText).toBe('Save and overwrite');
    await expect(session.retrySave?.()).resolves.toEqual(result);
    expect(updateNotebook).toHaveBeenCalledTimes(1);
  });

  it('writes held-back edits when the page goes hidden, the last thing a closing tab sees', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    await retitle(session, 'Before the tab closed');
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    document.dispatchEvent(new Event('visibilitychange'));
    visibility.mockRestore();

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(scene.state.isComposing).toBe(true);
    await expect(session.exit()).resolves.toEqual({ save: { status: 'saved' } });
    expect(updateNotebook).toHaveBeenCalledTimes(1);
  });

  it('saves when the page navigates away mid-session, and reports it through `closed`', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    await retitle(session, 'Before leaving');

    leave(scene);

    expect(session.signal.aborted).toBe(true);
    await expect(session.closed).resolves.toEqual({ save: { status: 'saved' } });
    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateNotebook).mock.calls[0][1]).toMatchObject({ title: 'Before leaving' });
  });

  it('saves when its toggle is turned off mid-session', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    await retitle(session, 'Before flag-off');

    setTestFlags({ [NOTEBOOKS_FLAG]: true });

    await expect(session.closed).resolves.toEqual({ save: { status: 'saved' } });
    expect(scene.state.isComposing).toBe(false);
    expect(updateNotebook).toHaveBeenCalledTimes(1);
  });

  it('saves a held-back edit when entering edit mode by hand ends the session', async () => {
    const scene = onRoute();
    const session = enterNotebookComposer(scene);
    await retitle(session, 'Then by hand');

    scene.onEnterEditMode();

    expect(scene.state.isEditing).toBe(true);
    await expect(session.closed).resolves.toEqual({ save: { status: 'saved' } });
  });
});
