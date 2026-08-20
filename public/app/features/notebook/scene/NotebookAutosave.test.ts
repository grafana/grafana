import { SceneObjectBase, SceneRefreshPicker, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { updateNotebook } from '../api/notebookResource';

import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

// The network write is the only thing stubbed. Everything above it is the real scene, the real layout
// manager and the real serializer, so the spec these tests assert on is the one that would be sent.
jest.mock('../api/notebookResource', () => ({
  updateNotebook: jest.fn(),
}));

// Mirrors the constants in NotebookAutosave. Duplicated rather than exported so that changing a timing
// number has to be a deliberate edit here too.
const IDLE_BEFORE_SAVE_MS = 2000;
const MAX_WAIT_MS = 15000;

/** Concrete stand-in: SceneObjectBase is abstract, and overlay just needs a SceneObject. */
class TestOverlay extends SceneObjectBase {}

function buildScene() {
  return new NotebookScene({
    uid: 'nb-1',
    title: 'My notebook',
    body: new NotebookLayoutManager({
      cells: [
        new NotebookCellItem({
          elementName: 'md1',
          source: 'user',
          content: { kind: 'Markdown', spec: { text: 'Hello' } },
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    // No refresh interval: an active refresh picker schedules its own timers, which the fake clock
    // below would then drive alongside the debounce.
    refreshPicker: new SceneRefreshPicker({ refresh: '', intervals: ['10s'] }),
  });
}

function editFirstCell(scene: NotebookScene, text: string) {
  const [cell] = scene.state.body.state.cells;
  scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text } });
}

function savedTexts() {
  return jest.mocked(updateNotebook).mock.calls.map(([, spec]) => {
    const element = spec.elements.md1;
    return element.kind === 'Cell' && element.spec.content.kind === 'Markdown' ? element.spec.content.spec.text : '';
  });
}

describe('NotebookAutosave', () => {
  let deactivate: (() => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    jest.mocked(updateNotebook).mockReset().mockResolvedValue({ generation: 2 });
  });

  afterEach(() => {
    deactivate?.();
    deactivate = undefined;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function activateEditing() {
    const scene = buildScene();
    deactivate = scene.activate();
    scene.onEnterEditMode();
    return scene;
  }

  it('saves an edit made in edit mode, with no save button', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    const [uid, spec] = jest.mocked(updateNotebook).mock.calls[0];
    expect(uid).toBe('nb-1');
    expect(spec.elements.md1).toEqual({
      kind: 'Cell',
      spec: { content: { kind: 'Markdown', spec: { text: 'Hello world' } } },
    });
    expect(scene.autosave.state.status).toBe('saved');
  });

  it('reports unsaved changes while a save is still waiting on the debounce', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Hello world');

    expect(scene.autosave.state.status).toBe('pending');
    expect(updateNotebook).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(scene.autosave.state.status).toBe('saved');
  });

  // Lots of things change the scene without changing what gets saved. Reporting those would have the
  // notebook claim unsaved changes it does not have.
  it('reports no unsaved changes when the change did not touch the spec', async () => {
    const scene = activateEditing();

    scene.showModal(new TestOverlay({}));
    expect(scene.autosave.state.status).toBe('idle');

    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
    expect(scene.autosave.state.status).toBe('idle');
  });

  it('goes on saying saved when a spec-less change follows a real save', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    scene.showModal(new TestOverlay({}));
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(scene.autosave.state.status).toBe('saved');
  });

  // Coming back to a notebook reuses the cached scene and reactivates it, so this is the same
  // controller it was before, holding edits that never reached the server.
  it('still sends an edit whose save failed, after leaving the notebook and coming back', async () => {
    const scene = activateEditing();
    jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));

    editFirstCell(scene, 'work I would rather not lose');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
    expect(scene.autosave.state.status).toBe('error');

    deactivate?.();
    deactivate = scene.activate();
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(savedTexts()).toEqual(['work I would rather not lose', 'work I would rather not lose']);
    expect(scene.autosave.state.status).toBe('saved');
  });

  it('sends nothing when a notebook with no unsaved work is reopened', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
    expect(updateNotebook).toHaveBeenCalledTimes(1);

    deactivate?.();
    deactivate = scene.activate();
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
  });

  it('sends a failed save again when asked to retry', async () => {
    const scene = activateEditing();
    jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
    expect(scene.autosave.state.status).toBe('error');

    scene.autosave.retry();
    await jest.advanceTimersByTimeAsync(0);

    expect(savedTexts()).toEqual(['Hello world', 'Hello world']);
    expect(scene.autosave.state.status).toBe('saved');
  });

  it('records the generation the server returned, so a later load can tell its own save apart', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(scene.autosave.state.savedGeneration).toBe(2);
  });

  it('records no generation when the response carried none', async () => {
    const scene = activateEditing();
    jest.mocked(updateNotebook).mockResolvedValue({});

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(scene.autosave.state.status).toBe('saved');
    expect(scene.autosave.state.savedGeneration).toBeUndefined();
  });

  it('does not save a time range change made outside edit mode', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    scene.state.$timeRange.setState({ from: 'now-1h', to: 'now' });
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  // A notebook opens at the time range it was saved with, so a range someone picked while reading it must
  // not become the range it opens at for everyone else.
  it('keeps the saved time range when a reader moved theirs before editing something else', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    scene.state.$timeRange.setState({ from: 'now-1h', to: 'now' });
    scene.onEnterEditMode();
    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(savedTexts()).toEqual(['Hello world']);
    expect(jest.mocked(updateNotebook).mock.calls[0][1].timeSettings.from).toBe('now-6h');
  });

  it('sends nothing when a notebook is reopened after a reader moved the time range', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    scene.state.$timeRange.setState({ from: 'now-1h', to: 'now' });
    deactivate();
    deactivate = scene.activate();
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  it('reports nothing when edit mode is entered and nothing has been changed', async () => {
    const scene = activateEditing();

    expect(scene.autosave.state.status).toBe('idle');

    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  it('saves a time range change made in edit mode', async () => {
    const scene = activateEditing();

    scene.state.$timeRange.setState({ from: 'now-1h', to: 'now' });
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateNotebook).mock.calls[0][1].timeSettings.from).toBe('now-1h');
  });

  // A writer that does not go through edit mode asks for the save itself. APPLY_NOTEBOOK_SPEC is the
  // one that matters; that it actually calls this is covered in applyNotebookSpec.test.ts.
  it('saves a change announced by a writer that is not in edit mode', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    scene.state.body.state.cells[0].setState({ content: { kind: 'Markdown', spec: { text: 'Written elsewhere' } } });
    // No clock advanced: this caller is handed the outcome, so its save cannot sit on the debounce.
    await scene.autosave.saveDocumentChange();

    expect(scene.state.isEditing).toBeFalsy();
    expect(savedTexts()).toEqual(['Written elsewhere']);
  });

  it('tells a writer whose save failed, instead of letting it report a write that never landed', async () => {
    jest.mocked(updateNotebook).mockRejectedValue(new Error('The notebook was changed by someone else.'));
    const scene = buildScene();
    deactivate = scene.activate();

    scene.state.body.state.cells[0].setState({ content: { kind: 'Markdown', spec: { text: 'Written elsewhere' } } });

    await expect(scene.autosave.saveDocumentChange()).rejects.toThrow('The notebook was changed by someone else.');
    expect(scene.autosave.state.status).toBe('error');
  });

  it('writes nothing when the announced document is already what was saved', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    await scene.autosave.saveDocumentChange();

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  // The change is carried by the save queued behind the request already running, so waiting on the
  // running one would hand the writer a success before its own content had been written.
  it('waits for the queued save when a save was already in flight', async () => {
    let finishFirstSave = () => {};
    jest
      .mocked(updateNotebook)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirstSave = () => resolve({ generation: 2 });
          })
      )
      .mockResolvedValue({ generation: 3 });

    const scene = activateEditing();
    editFirstCell(scene, 'First');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    editFirstCell(scene, 'Second');
    const saved = scene.autosave.saveDocumentChange();
    finishFirstSave();
    await saved;

    expect(savedTexts()).toEqual(['First', 'Second']);
  });

  it('collapses several rapid edits into one request carrying the last of them', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'one');
    await jest.advanceTimersByTimeAsync(100);
    editFirstCell(scene, 'two');
    await jest.advanceTimersByTimeAsync(100);
    editFirstCell(scene, 'three');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(savedTexts()).toEqual(['three']);
  });

  it('saves at the ceiling when typing never pauses long enough to go quiet', async () => {
    const scene = activateEditing();

    for (let i = 0; i < 14; i++) {
      editFirstCell(scene, `keystroke ${i}`);
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS / 2);
    }

    expect(updateNotebook).not.toHaveBeenCalled();

    editFirstCell(scene, 'last keystroke');
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS - 14 * (IDLE_BEFORE_SAVE_MS / 2));

    expect(updateNotebook).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when an edit is undone back to the original content', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Changed');
    editFirstCell(scene, 'Hello');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  it('leaves the undo history intact after a save', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'Hello world');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(scene.editHistory.state.canUndo).toBe(true);
    expect(scene.editHistory.undo()).toBe(true);
    expect(scene.state.body.state.cells[0].state.content).toEqual({ kind: 'Markdown', spec: { text: 'Hello' } });
  });

  it('carries a failed edit into the next save rather than losing it', async () => {
    const scene = activateEditing();
    jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));

    editFirstCell(scene, 'first');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(scene.autosave.state.status).toBe('error');
    expect(scene.autosave.state.errorMessage).toBe('apiserver said no');

    editFirstCell(scene, 'second');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(savedTexts()).toEqual(['first', 'second']);
    expect(scene.autosave.state.status).toBe('saved');
  });

  it('flushes a pending edit when the scene is torn down', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'typed just before leaving');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS / 4);
    expect(updateNotebook).not.toHaveBeenCalled();

    deactivate?.();
    deactivate = undefined;

    expect(savedTexts()).toEqual(['typed just before leaving']);
  });

  it('flushes a pending edit when the page is hidden', async () => {
    const scene = activateEditing();

    editFirstCell(scene, 'typed just before hiding');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS / 4);
    expect(updateNotebook).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(savedTexts()).toEqual(['typed just before hiding']);
  });
});
