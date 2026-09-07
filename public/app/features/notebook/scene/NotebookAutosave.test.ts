import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneObjectBase, SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { ShowConfirmModalEvent } from 'app/types/events';

import { createNotebook, updateNotebook } from '../api/notebookResource';
import { defaultVisualizationPanelKind } from '../types';

import { NotebookScene } from './NotebookScene';
import { NotebookCellItem } from './layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from './layout-notebook/NotebookLayoutManager';

// The network write is the only thing stubbed. Everything above it is the real scene, the real layout
// manager and the real serializer, so the spec these tests assert on is the one that would be sent.
jest.mock('../api/notebookResource', () => ({
  createNotebook: jest.fn(),
  updateNotebook: jest.fn(),
}));

// Mirrors the constants in NotebookAutosave. Duplicated rather than exported so that changing a timing
// number has to be a deliberate edit here too.
const IDLE_BEFORE_SAVE_MS = 2000;
/** The longest a change can wait, so a test expecting no write advances by this. */
const MAX_WAIT_MS = 15000;

// The panel cases below restore a saved viz config through the panel's own option/fieldConfig API,
// and that re-applies the plugin's defaults, so the panels here need a plugin that actually loads.
// It answers to the id asked for, or every load would look like a switch to a different plugin.
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({ id }).useFieldConfig()),
  getPanelPluginFromCache: () => undefined,
});

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

/** A notebook whose only cell is a panel, for the reader-owned viz config cases below. */
function buildSceneWithPanel() {
  const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
  const cell = new NotebookCellItem({ elementName: 'panel1', source: 'user', body: panel });

  const scene = new NotebookScene({
    uid: 'nb-1',
    title: 'My notebook',
    body: new NotebookLayoutManager({ cells: [cell] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({ refresh: '', intervals: ['10s'] }),
  });

  return { scene, cell, panel };
}

/** What reading does to a panel: picking a colour off the legend writes a field override. */
function recolourLegend(panel: VizPanel, color = 'red') {
  panel.setState({
    fieldConfig: {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'up' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: color } }],
        },
      ],
    },
  });
}

/** The viz config of the panel element in each write, so a test can say what was actually sent. */
function savedVizConfigs() {
  return jest.mocked(updateNotebook).mock.calls.map(([, spec]) => {
    const element = spec.elements.panel1;
    return element.kind === 'Panel' ? element.spec.vizConfig : undefined;
  });
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
    jest
      .mocked(createNotebook)
      .mockReset()
      .mockResolvedValue({ uid: 'nb-new', url: '/notebooks/nb-new', generation: 1 });
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

  // Time settings already have their own exclusion: buildSpecToSave substitutes the saved ones back in
  // while timeSettingsEdited is false. That is why the test above already passed. Nothing else had that
  // protection. A panel's fieldConfig, for example, changed like any other content and got swept into a
  // save the moment the scene reactivated, with nothing checking whether editing was ever entered.
  it('sends nothing when a notebook is reopened after something changed outside edit mode', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    editFirstCell(scene, 'changed without ever entering edit mode');
    deactivate();
    deactivate = scene.activate();
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  /** Meant to stay theirs: visible while they are reading, and never written. */
  describe('a viz config a reader changed', () => {
    it('is not written, and is not reported as an unsaved change when edit mode opens', async () => {
      const { scene, panel } = buildSceneWithPanel();
      deactivate = scene.activate();

      recolourLegend(panel);
      scene.onEnterEditMode();

      expect(scene.autosave.state.status).toBe('idle');

      // Advance past the autosave ceiling to prove entering edit mode did not queue a write.
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    it('stays on the panel for as long as they are reading it', async () => {
      const { scene, panel } = buildSceneWithPanel();
      deactivate = scene.activate();

      recolourLegend(panel);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(panel.state.fieldConfig.overrides).toHaveLength(1);
    });

    /** A panel loads its plugin on activate, which a renderer would do, and both answers need it. */
    describe('the prompt shown when edit mode opens', () => {
      async function readAndRecolour() {
        const { scene, panel } = buildSceneWithPanel();
        deactivate = scene.activate();
        const stopPanel = panel.activate();
        await jest.advanceTimersByTimeAsync(0);

        recolourLegend(panel);
        const publish = jest.spyOn(appEvents, 'publish');
        scene.onEnterEditMode();

        const event = publish.mock.calls
          .map(([published]) => published)
          .find((published) => published instanceof ShowConfirmModalEvent);

        return { scene, panel, stopPanel, payload: event?.payload };
      }

      it('is not shown when the reader left the notebook looking as it was saved', async () => {
        const { scene, panel } = buildSceneWithPanel();
        deactivate = scene.activate();
        const stopPanel = panel.activate();
        await jest.advanceTimersByTimeAsync(0);

        const publish = jest.spyOn(appEvents, 'publish');
        scene.onEnterEditMode();

        expect(publish.mock.calls.some(([published]) => published instanceof ShowConfirmModalEvent)).toBe(false);
        expect(scene.state.isEditing).toBe(true);

        stopPanel();
      });

      it('is not shown when the reader reverted their change before editing', async () => {
        const { scene, panel } = buildSceneWithPanel();
        deactivate = scene.activate();
        const stopPanel = panel.activate();
        await jest.advanceTimersByTimeAsync(0);

        const savedFieldConfig = panel.state.fieldConfig;
        recolourLegend(panel);
        panel.setState({ fieldConfig: savedFieldConfig });

        const publish = jest.spyOn(appEvents, 'publish');
        scene.onEnterEditMode();

        expect(publish.mock.calls.some(([published]) => published instanceof ShowConfirmModalEvent)).toBe(false);
        expect(scene.state.isEditing).toBe(true);

        stopPanel();
      });

      // Cancel, escape and the close button cannot carry an answer, and this is why none need to.
      it('holds the notebook in view mode until the question is answered', async () => {
        const { scene, panel, stopPanel, payload } = await readAndRecolour();

        expect(payload).toBeDefined();
        expect(scene.state.isEditing).toBeFalsy();

        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

        expect(scene.state.isEditing).toBeFalsy();
        expect(panel.state.fieldConfig.overrides).toHaveLength(1);
        expect(updateNotebook).not.toHaveBeenCalled();
        // Still pending, so the next attempt at editing asks again rather than letting it through.
        expect(scene.autosave.viewOnlyVizChanges()).toEqual(['panel1']);

        stopPanel();
      });

      // Nothing saved behind it, so prompting would offer a choice that does nothing either way.
      it('is not shown for a panel whose saved look we do not hold', async () => {
        const scene = buildScene();
        deactivate = scene.activate();

        const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
        const cell = new NotebookCellItem({ elementName: 'added-now', source: 'user', body: panel });
        scene.state.body.setState({ cells: [...scene.state.body.state.cells, cell] });

        const stopPanel = panel.activate();
        await jest.advanceTimersByTimeAsync(0);
        recolourLegend(panel);

        const publish = jest.spyOn(appEvents, 'publish');
        scene.onEnterEditMode();

        expect(publish.mock.calls.some(([published]) => published instanceof ShowConfirmModalEvent)).toBe(false);

        stopPanel();
      });

      it('writes the colour when they keep it', async () => {
        const { scene, panel, stopPanel, payload } = await readAndRecolour();

        // Keep is the modal's alternative action, not its confirm: see askAboutViewOnlyChanges.
        payload?.onAltAction?.();
        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

        expect(scene.state.isEditing).toBe(true);
        expect(panel.state.fieldConfig.overrides).toHaveLength(1);
        expect(savedVizConfigs()[0]?.spec.fieldConfig.overrides).toHaveLength(1);

        stopPanel();
      });

      // Keep is an edit like any other, so the retry that protects a failed edit has to cover it too.
      it('sends the kept colour again when its save failed and the notebook is reopened', async () => {
        const { scene, stopPanel, payload } = await readAndRecolour();
        jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));

        payload?.onAltAction?.();
        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
        expect(scene.autosave.state.status).toBe('error');

        deactivate?.();
        deactivate = scene.activate();
        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

        expect(updateNotebook).toHaveBeenCalledTimes(2);
        expect(savedVizConfigs()[1]?.spec.fieldConfig.overrides).toHaveLength(1);

        stopPanel();
      });

      it('puts the saved colour back and writes nothing when they discard it', async () => {
        const { scene, panel, stopPanel, payload } = await readAndRecolour();

        payload?.onConfirm?.();
        await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

        expect(scene.state.isEditing).toBe(true);
        expect(panel.state.fieldConfig.overrides).toEqual([]);
        expect(updateNotebook).not.toHaveBeenCalled();

        stopPanel();
      });

      it('preserves a failed edit when discarding a later view-only change', async () => {
        const { scene, panel } = buildSceneWithPanel();
        deactivate = scene.activate();
        const stopPanel = panel.activate();
        await jest.advanceTimersByTimeAsync(0);

        scene.onEnterEditMode();
        recolourLegend(panel, 'red');
        jest.mocked(updateNotebook).mockRejectedValueOnce(new Error('apiserver said no'));
        await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
        scene.onExitEditMode();

        recolourLegend(panel, 'blue');
        const publish = jest.spyOn(appEvents, 'publish');
        scene.onEnterEditMode();
        const event = publish.mock.calls
          .map(([published]) => published)
          .find((published) => published instanceof ShowConfirmModalEvent);
        event?.payload.onConfirm?.();

        expect(panel.state.fieldConfig.overrides[0].properties[0].value).toEqual({
          mode: 'fixed',
          fixedColor: 'red',
        });

        await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
        expect(updateNotebook).toHaveBeenCalledTimes(2);
        expect(savedVizConfigs()[1]?.spec.fieldConfig.overrides[0].properties[0].value).toEqual({
          mode: 'fixed',
          fixedColor: 'red',
        });

        stopPanel();
      });
    });

    // The other half of the rule: a writer who recolours has to get it back when they reload.
    it('is written when the change was made in edit mode', async () => {
      const { scene, panel } = buildSceneWithPanel();
      deactivate = scene.activate();
      scene.onEnterEditMode();

      recolourLegend(panel);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).toHaveBeenCalledTimes(1);
      expect(savedVizConfigs()[0]?.spec.fieldConfig.overrides).toHaveLength(1);
    });

    // A query can suggest a visualization, which switches the panel's plugin (see PanelQueryEditor).
    // That is written by the same plugin load that applies a plugin's defaults, so it is only told
    // apart from one by the id having moved. Taken for a plugin load, the switch is never saved.
    it('is written when a panel was switched to another visualization in edit mode', async () => {
      const { scene, panel } = buildSceneWithPanel();
      deactivate = scene.activate();
      const stopPanel = panel.activate();
      await jest.advanceTimersByTimeAsync(0);

      scene.onEnterEditMode();
      await panel.changePluginType('table', { showHeader: true }, undefined);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(savedVizConfigs()[0]?.group).toBe('table');

      stopPanel();
    });

    // Disowned when the session starts, so it stays out even though that panel is the one edited.
    it('is not written when a reader set it before edit mode and only a query was edited after', async () => {
      const { scene, cell, panel } = buildSceneWithPanel();
      deactivate = scene.activate();

      recolourLegend(panel);
      scene.onEnterEditMode();
      cell.onQueryChange([{ refId: 'A', expr: 'up' } as DataQuery]);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).toHaveBeenCalledTimes(1);
      expect(savedVizConfigs()[0]?.spec.fieldConfig.overrides).toEqual([]);
    });

    // Nothing saved to disown, so its own config is the one to write. Substituting an absent one
    // would save a panel with no visualization at all.
    it('is still written in full for a panel added in this session', async () => {
      const scene = activateEditing();
      const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
      const cell = new NotebookCellItem({ elementName: 'panel1', source: 'user', body: panel });

      scene.state.body.setState({ cells: [...scene.state.body.state.cells, cell] });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).toHaveBeenCalledTimes(1);
      expect(savedVizConfigs()[0]?.group).toBe('timeseries');
    });

    it('does not reuse the saved config when a panel is replaced with the same element name', async () => {
      const { scene } = buildSceneWithPanel();
      deactivate = scene.activate();
      scene.onEnterEditMode();

      const replacementPanel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 2));
      recolourLegend(replacementPanel);
      const replacementCell = new NotebookCellItem({
        elementName: 'panel1',
        source: 'user',
        body: replacementPanel,
      });

      scene.state.body.setState({ cells: [replacementCell] });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(savedVizConfigs()[0]?.spec.fieldConfig.overrides).toHaveLength(1);
    });
  });

  // Entering edit mode is itself a state change, and without care the handler that watches for edits
  // would mark it as one. Left set, a later reactivation reschedules a save on the strength of that
  // stale flag alone, and picks up whatever changed outside edit mode in between as if it were the
  // edit that justified it.
  it('does not let a change outside edit mode ride in on a reactivation after an edit-less visit', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    scene.onEnterEditMode();
    scene.onExitEditMode();
    editFirstCell(scene, 'changed outside edit mode');
    deactivate();
    deactivate = scene.activate();
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(updateNotebook).not.toHaveBeenCalled();
  });

  // The renderer keeps a trailing empty block ready the moment edit mode opens (see
  // NotebookLayoutManager), which appends a cell of its own: a second state change from entering edit
  // mode, on top of the isEditing flag itself. Simulated directly, the same way the other
  // trailing-block tests below do, because there is no renderer here.
  it('does not let a change outside edit mode ride in on a reactivation after the trailing block was replenished', async () => {
    const scene = buildScene();
    deactivate = scene.activate();

    scene.onEnterEditMode();
    scene.state.body.appendSystemCell(scene.state.body.state.cells.length);
    scene.onExitEditMode();
    editFirstCell(scene, 'changed outside edit mode');
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

  // A document rebuilds the scene, so the panel looks it carries are the notebook's. Held back as a
  // reader's, a document that only restyled a panel matched what was saved and wrote nothing at all.
  it('saves the panel looks carried by a document announced by a writer', async () => {
    const { scene, panel } = buildSceneWithPanel();
    deactivate = scene.activate();

    recolourLegend(panel);
    await scene.autosave.saveDocumentChange();

    expect(savedVizConfigs()[0]?.spec.fieldConfig.overrides).toHaveLength(1);
  });

  // The scene a reader changed is gone, replaced by the document. Left pending, the prompt would offer
  // to put back a look the write had already replaced.
  it('stops asking about a reader change once an announced document has replaced it', async () => {
    const { scene, panel } = buildSceneWithPanel();
    deactivate = scene.activate();
    const stopPanel = panel.activate();
    await jest.advanceTimersByTimeAsync(0);

    recolourLegend(panel);
    await scene.autosave.saveDocumentChange();

    const publish = jest.spyOn(appEvents, 'publish');
    scene.onEnterEditMode();

    expect(publish.mock.calls.some(([published]) => published instanceof ShowConfirmModalEvent)).toBe(false);
    expect(scene.state.isEditing).toBe(true);

    stopPanel();
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

  it('keeps a time range edit made while an earlier save is in flight', async () => {
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

    scene.state.$timeRange.setState({ from: 'now-1h', to: 'now' });
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
    finishFirstSave();
    await jest.advanceTimersByTimeAsync(0);

    expect(updateNotebook).toHaveBeenCalledTimes(2);
    expect(jest.mocked(updateNotebook).mock.calls[0][1].timeSettings.from).toBe('now-6h');
    expect(jest.mocked(updateNotebook).mock.calls[1][1].timeSettings.from).toBe('now-1h');
  });

  it('keeps a panel edit made while an earlier panel save is in flight', async () => {
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

    const { scene, panel } = buildSceneWithPanel();
    deactivate = scene.activate();
    scene.onEnterEditMode();

    recolourLegend(panel, 'red');
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    recolourLegend(panel, 'blue');
    finishFirstSave();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(2);
    expect(savedVizConfigs()[1]?.spec.fieldConfig.overrides).toEqual([
      {
        matcher: { id: 'byName', options: 'up' },
        properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'blue' } }],
      },
    ]);
  });

  it('clears writer ownership when a queued save has no spec change', async () => {
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

    scene.showModal(new TestOverlay({}));
    await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
    finishFirstSave();
    await jest.advanceTimersByTimeAsync(0);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
    expect(scene.autosave.state.status).toBe('saved');

    scene.onExitEditMode();
    editFirstCell(scene, 'changed outside edit mode');
    deactivate?.();
    deactivate = scene.activate();
    await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

    expect(updateNotebook).toHaveBeenCalledTimes(1);
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

  /**
   * Editing keeps an empty block at the bottom ready to type in, appended by the layout renderer on
   * every edit-mode entry. Nobody typed it, so none of these may write.
   *
   * These call appendSystemCell directly because there is no renderer here. It is the same method the
   * renderer's bootstrap effect calls, not a test-only door into the manager.
   */
  describe("the editor's trailing empty block", () => {
    function appendTrailingBlock(scene: NotebookScene) {
      scene.state.body.appendSystemCell(scene.state.body.state.cells.length);
    }

    it('is not saved when entering edit mode is all that happened', async () => {
      const scene = activateEditing();

      appendTrailingBlock(scene);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    // The blank-notebook case: no cells at all, so the block is the only thing in the document.
    it('is not saved when it is the only cell in the notebook', async () => {
      const scene = buildScene();
      scene.state.body.setState({ cells: [] });
      deactivate = scene.activate();
      scene.onEnterEditMode();

      appendTrailingBlock(scene);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    it('is saved once it is typed into, and the block replacing it is not', async () => {
      const scene = activateEditing();
      appendTrailingBlock(scene);
      const [, trailing] = scene.state.body.state.cells;

      // Typing into the last empty block appends a fresh one behind it, so this is also the check that
      // the replacement does not come back round as a second save.
      scene.state.body.setCellContent(trailing, { kind: 'Markdown', spec: { text: 'a second thought' } });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).toHaveBeenCalledTimes(1);
      const [, spec] = jest.mocked(updateNotebook).mock.calls[0];
      expect(Object.keys(spec.elements)).toEqual(['md1', trailing.state.elementName]);
      expect(spec.layout.spec.cells).toHaveLength(2);
    });
  });

  /**
   * A notebook nobody has saved yet has no uid, and its first write is what creates it. Clicking New
   * notebook must leave nothing behind, so the create has to wait for something worth saving.
   */
  describe('a notebook that has not been created yet', () => {
    function activateBlankEditing() {
      const scene = buildScene();
      scene.setState({ uid: undefined });
      scene.state.body.setState({ cells: [] });
      deactivate = scene.activate();
      scene.onEnterEditMode();
      return scene;
    }

    /** What the editor does: keep an empty block ready, then the person types into it. */
    function typeIntoIt(scene: NotebookScene, text: string) {
      const cell = scene.state.body.appendSystemCell(scene.state.body.state.cells.length)!;
      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text } });
      return cell;
    }

    function createdSpecs() {
      return jest.mocked(createNotebook).mock.calls.map(([spec]) => spec);
    }

    it('is created by the first thing typed into it, and never updated instead', async () => {
      const scene = activateBlankEditing();

      typeIntoIt(scene, 'first thought');
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(createNotebook).toHaveBeenCalledTimes(1);
      expect(updateNotebook).not.toHaveBeenCalled();
      const [spec] = createdSpecs();
      expect(Object.values(spec.elements)).toEqual([
        { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'first thought' } } } },
      ]);
      expect(scene.state.uid).toBe('nb-new');
    });

    it('is not created at all when nothing was typed', async () => {
      const scene = activateBlankEditing();

      // The block the editor keeps ready is not content, so this is a notebook someone opened and left.
      scene.state.body.appendSystemCell(0);
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);
      deactivate?.();
      deactivate = undefined;

      expect(createNotebook).not.toHaveBeenCalled();
      expect(scene.state.uid).toBeUndefined();
    });

    it('is created once when several edits land inside one debounce window', async () => {
      const scene = activateBlankEditing();
      const cell = typeIntoIt(scene, 'one');

      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'one two' } });
      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'one two three' } });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(createNotebook).toHaveBeenCalledTimes(1);
    });

    // The dangerous case: a keystroke while the create is still in flight. The queued save has to update
    // the notebook the create just made, not make a second one.
    it('updates rather than creating twice when an edit arrives mid-create', async () => {
      let finishCreate = (created: { uid: string; url: string; generation?: number }) => {};
      jest.mocked(createNotebook).mockReturnValue(
        new Promise((resolve) => {
          finishCreate = resolve;
        })
      );

      const scene = activateBlankEditing();
      const cell = typeIntoIt(scene, 'typed before');
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);
      expect(createNotebook).toHaveBeenCalledTimes(1);

      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'typed during' } });
      finishCreate({ uid: 'nb-new', url: '/notebooks/nb-new', generation: 1 });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(createNotebook).toHaveBeenCalledTimes(1);
      expect(updateNotebook).toHaveBeenCalledTimes(1);
      expect(jest.mocked(updateNotebook).mock.calls[0][0]).toBe('nb-new');
    });

    // Waits for the debounce, not the ceiling the test below uses: the save an unguarded adoption
    // schedules has cleared itself by then, so the longer wait hides this rather than catching it.
    it('does not report unsaved changes when the uid it was just given lands on the scene', async () => {
      const scene = activateBlankEditing();

      typeIntoIt(scene, 'first thought');
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(scene.autosave.state.status).toBe('saved');
      expect(updateNotebook).not.toHaveBeenCalled();
    });

    // Taking the uid onto the scene is itself a state change, so it schedules another save. That save has
    // nothing to write, and the notebook has to end up reported as saved rather than stuck on pending.
    it('settles as saved after the create, without writing a second time', async () => {
      const scene = activateBlankEditing();

      typeIntoIt(scene, 'first thought');
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(scene.autosave.state.status).toBe('saved');
      expect(createNotebook).toHaveBeenCalledTimes(1);
      expect(updateNotebook).not.toHaveBeenCalled();
    });

    it('keeps the content and retries when the create failed', async () => {
      jest.mocked(createNotebook).mockRejectedValueOnce(new Error('nope'));
      const scene = activateBlankEditing();

      typeIntoIt(scene, 'first thought');
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(scene.autosave.state.status).toBe('error');
      expect(scene.state.uid).toBeUndefined();

      scene.autosave.retry();
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(createNotebook).toHaveBeenCalledTimes(2);
      // The failed attempt left the baseline alone, so the retry still carries what was typed.
      expect(Object.values(createdSpecs()[1].elements)).toEqual([
        { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'first thought' } } } },
      ]);
      expect(scene.state.uid).toBe('nb-new');
    });

    it('updates the notebook it created for every change after the first', async () => {
      const scene = activateBlankEditing();
      const cell = typeIntoIt(scene, 'first thought');
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'second thought' } });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(createNotebook).toHaveBeenCalledTimes(1);
      expect(updateNotebook).toHaveBeenCalledTimes(1);
      expect(jest.mocked(updateNotebook).mock.calls[0][0]).toBe('nb-new');
    });

    it('is created on the way out when it is left before the debounce fired', async () => {
      const scene = activateBlankEditing();

      typeIntoIt(scene, 'typed just before leaving');
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS / 4);
      expect(createNotebook).not.toHaveBeenCalled();

      deactivate?.();
      deactivate = undefined;

      expect(createNotebook).toHaveBeenCalledTimes(1);
    });
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

  describe('abandon', () => {
    // The whole reason abandon exists: delete navigates away, the scene tears down, and teardown
    // flushes. Without the latch that flush writes the spec back to a notebook the server has just
    // removed, and a successful delete reports itself as a failed save.
    it('does not write a pending edit when the scene is torn down', async () => {
      const scene = activateEditing();
      editFirstCell(scene, 'Hello world');

      scene.autosave.abandon();
      deactivate?.();
      deactivate = undefined;
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    // The debounce is cancelled outright, so time passing on its own writes nothing either.
    it('does not write a pending edit when the debounce comes due', async () => {
      const scene = activateEditing();
      editFirstCell(scene, 'Hello world');

      scene.autosave.abandon();
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    // The latch, not just the cancelled debounce: the change subscription is still live while the
    // scene tears down, so an edit landing after abandon must not schedule a fresh save.
    it('ignores an edit made after it', async () => {
      const scene = activateEditing();

      scene.autosave.abandon();
      editFirstCell(scene, 'Written after the delete');
      await jest.advanceTimersByTimeAsync(IDLE_BEFORE_SAVE_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    // The latch alone would already stop the write - saveNow checks it. This pins the cancel as well,
    // so a scene on its way out does not leave a debounce timer holding it alive for another 15s.
    it('releases the scheduled save rather than leaving the timer running', () => {
      const scene = activateEditing();
      editFirstCell(scene, 'Hello world');
      // Relative rather than an absolute count: the scene has timers of its own, and this is only
      // claiming that abandon drops the one the debounce scheduled.
      const scheduled = jest.getTimerCount();

      scene.autosave.abandon();

      expect(jest.getTimerCount()).toBeLessThan(scheduled);
    });

    // The status line sits in the toolbar beside the delete. Leaving it on 'pending' would have the
    // page claim unsaved changes while it navigates away from a notebook that no longer exists.
    it('stops the notebook reporting unsaved changes', () => {
      const scene = activateEditing();
      editFirstCell(scene, 'Hello world');
      expect(scene.autosave.state.status).toBe('pending');

      scene.autosave.abandon();

      expect(scene.autosave.state.status).toBe('idle');
    });
  });

  /**
   * A reader must not be able to make a notebook save itself.
   *
   * The refusals themselves live in NotebookScene and NotebookSceneUrlSync and are tested there. What
   * those tests cannot show is the thing that actually matters, which is that no request reaches the
   * network. That is what these assert, and it is why they belong here rather than beside the refusals.
   */
  describe('a reader who cannot write', () => {
    /**
     * Everything that makes this a reader, in one place: the permission is taken away, then edit mode
     * is asked for and refused because of that. The refusal is the only reason nothing gets written,
     * so this test checks it directly. Without that check, every test below would still pass even for
     * a notebook that had nothing to save.
     *
     * `blank` gives a notebook that does not exist yet, the state the /notebooks/new route leaves a
     * reader in. Worth covering separately because that route only asks for `dashboards:create`, and
     * being allowed to create is not the same as being allowed to write.
     */
    function activateAsReader({ blank = false } = {}) {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      const scene = buildScene();
      if (blank) {
        scene.setState({ uid: undefined });
        scene.state.body.setState({ cells: [] });
      }

      deactivate = scene.activate();
      scene.onEnterEditMode();
      expect(scene.state.isEditing).toBeFalsy();

      return scene;
    }

    it('writes nothing when the document changes under a reader', async () => {
      const scene = activateAsReader();

      editFirstCell(scene, 'text a reader should not be able to save');
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
      expect(createNotebook).not.toHaveBeenCalled();
      expect(scene.autosave.state.status).toBe('idle');
    });

    it('creates no notebook when the document is one that does not exist yet', async () => {
      const scene = activateAsReader({ blank: true });

      const cell = scene.state.body.appendSystemCell(0)!;
      scene.state.body.setCellContent(cell, { kind: 'Markdown', spec: { text: 'first thought' } });
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(createNotebook).not.toHaveBeenCalled();
    });

    it('writes nothing when a reader leaves the notebook', async () => {
      const scene = activateAsReader();

      editFirstCell(scene, 'text a reader should not be able to save');
      // Tearing down flushes whatever is pending, so this is where a scheduled save would escape.
      deactivate?.();
      deactivate = undefined;

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    // The change subscription above never sees this edit: it is gated on isEditing, and a reader never
    // gets there. But start() used to reschedule on every reactivation anyway, with nothing checking
    // where the difference came from. Reopening the notebook is where that difference used to turn into
    // a real request.
    it('writes nothing when a reader leaves and reopens the notebook', async () => {
      const scene = activateAsReader();

      editFirstCell(scene, 'text a reader should not be able to save');
      deactivate?.();
      deactivate = scene.activate();
      await jest.advanceTimersByTimeAsync(MAX_WAIT_MS);

      expect(updateNotebook).not.toHaveBeenCalled();
    });

    it('writes nothing when a reader hides the tab', async () => {
      const scene = activateAsReader();

      editFirstCell(scene, 'text a reader should not be able to save');
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(updateNotebook).not.toHaveBeenCalled();
    });
  });
});
