import { debounce, isEqual } from 'lodash';
import { type Unsubscribable } from 'rxjs';

import {
  SceneObjectStateChangedEvent,
  type SceneObjectState,
  type SceneObjectStateChangedPayload,
  type VizPanel,
} from '@grafana/scenes';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { createNotebook, updateNotebook } from '../api/notebookResource';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { type NotebookElement, type PanelKind, type Spec as NotebookSpec } from '../types';

import { type NotebookScene } from './NotebookScene';

type PanelVizConfigState = Pick<VizPanel['state'], 'pluginId' | 'pluginVersion' | 'options' | 'fieldConfig'>;

/**
 * Two seconds is about how long a pause means someone stopped typing, rather than thinking mid-sentence.
 * Save sooner and we save in the middle of a word, and every save sends the whole notebook.
 */
const IDLE_BEFORE_SAVE_MS = 2000;

/** Every update writes a `resource_history` row, so this caps someone typing non-stop at 4 saves a minute. */
const MAX_WAIT_MS = 15000;

export type NotebookSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface NotebookAutosaveState {
  status: NotebookSaveStatus;
  errorMessage?: string;
  /** The resource generation the last successful save produced, when the server reported one. */
  savedGeneration?: number;
}

/**
 * Saves a notebook as it is changed, with no save button.
 *
 * It watches the scene's own state changes, not the edit history, because the edit history records a
 * typing session once at the first keystroke and would miss everything typed after it. It does not try to
 * work out which changes matter: `saveNow` compares what would be saved against what was saved last, and
 * skips the write when they match.
 *
 * Changes only count while the notebook is being edited. Reading one changes it too: the time picker is
 * there for readers, and using a panel writes to its options and field config. Both belong to whoever
 * was reading rather than to the notebook, so both are held back from a save until someone editing says
 * otherwise. Writers that never enter edit mode call `saveDocumentChange` instead.
 */
export class NotebookAutosave extends StateManagerBase<NotebookAutosaveState> {
  /** The spec we treat as already written: what the last save sent, or the notebook as it was loaded. */
  private baseline?: string;
  /** The time settings of `baseline`, sent again for as long as nobody has edited them. */
  private savedTimeSettings?: NotebookSpec['timeSettings'];
  /** Whether the time settings now in the scene are the notebook's own, rather than one reader's. */
  private timeSettingsEdited = false;
  /** The viz config of each panel in `baseline`, by element name, sent again in place of the scene's. */
  private savedVizConfigs?: Map<string, PanelKind['spec']['vizConfig']>;
  /** The panel each saved viz config belongs to, so a reused element name cannot inherit it. */
  private savedVizPanels?: Map<string, VizPanel>;
  /** The panels whose viz config was edited this session, by element name. As `timeSettingsEdited`. */
  private vizConfigsEdited = new Set<string>();
  /** The panels a reader changed, by element name, waiting on the prompt edit mode opens with. */
  private vizConfigsChangedWhileReading = new Set<string>();
  /** Each panel's normalized state immediately before its first reader-owned change. */
  private vizConfigsBeforeReadingChange = new Map<
    string,
    { panel: VizPanel; config: PanelVizConfigState; wasEditedByWriter: boolean }
  >();
  /** Set while `discardVizChanges` writes, so restoring a panel is not recorded as editing it. */
  private restoringVizConfigs = false;
  /**
   * Whether the current difference from `baseline` came from an edit, not from a reader just looking at
   * the notebook. A reader using a panel changes scene state too. Without this flag, reopening the
   * notebook would save that change as if it were a real edit.
   */
  private editedByWriter = false;
  private changeSub?: Unsubscribable;
  private inFlight = false;
  /** Set while `write` adopts a freshly created uid, so that is not mistaken for someone's edit. */
  private adoptingUid = false;
  /** The save now running, so a caller that reports an outcome can wait for the write to land. */
  private inFlightSave?: Promise<void>;
  private saveAgainWhenIdle = false;
  private changePending = false;
  private hasSavedOnce = false;
  /** Latched by `abandon`, for a notebook that is being deleted. Nothing writes again after it. */
  private abandoned = false;

  public constructor(private scene: NotebookScene) {
    super({ status: 'idle' });
  }

  /** Begins watching for changes. Returns the teardown, which flushes anything still pending. */
  public start(): () => void {
    if (this.baseline === undefined) {
      // Entering edit mode publishes state changes of its own, so without a baseline the first
      // comparison would write the notebook straight back unchanged.
      this.recordWritten(this.buildSpecToSave());
    } else if (this.editedByWriter) {
      // A scene is cached and reactivated when you come back to a notebook, so this can be the same
      // controller holding an edit that never reached the server. Reschedule only if that edit came from
      // someone allowed to write. A reader using a panel leaves the same kind of difference behind, and
      // reopening the notebook must not save it.
      this.schedule();
    }

    this.changeSub = this.scene.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      if (this.adoptingUid || this.restoringVizConfigs) {
        return;
      }

      const revizzedPanel = changedVizConfigElement(payload, this.scene);

      if (!this.scene.state.isEditing) {
        // Remembered because it survives into edit mode looking like a change to the notebook.
        if (revizzedPanel) {
          this.vizConfigsChangedWhileReading.add(revizzedPanel);
          const panel = this.scene.state.body.state.cells.find(
            (cell) => cell.state.elementName === revizzedPanel && cell.state.body === payload.changedObject
          )?.state.body;
          const config = panelVizConfigState(payload.prevState);
          if (panel && config && !this.vizConfigsBeforeReadingChange.has(revizzedPanel)) {
            this.vizConfigsBeforeReadingChange.set(revizzedPanel, {
              panel,
              config,
              wasEditedByWriter: this.vizConfigsEdited.has(revizzedPanel),
            });
          }
        }
        return;
      }

      if (changesTimeSettings(payload, this.scene)) {
        this.timeSettingsEdited = true;
      }

      if (revizzedPanel) {
        this.vizConfigsEdited.add(revizzedPanel);
      }

      // Entering edit mode and the trailing empty block it keeps ready (see NotebookLayoutManager)
      // both publish state changes of their own, with nothing yet different to write. Answered once
      // and handed to `schedule`, because working it out serializes every panel in the notebook.
      const somethingToWrite = this.hasSomethingToWrite();
      if (somethingToWrite) {
        this.editedByWriter = true;
      }

      this.schedule(somethingToWrite);
    });

    // Not beforeunload: adding an unload listener stops the browser reusing the page when you navigate
    // back, for everyone. Going hidden is the last thing a page is sure to see before it disappears.
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    return () => this.stop();
  }

  /**
   * Saves a change made by a writer that does not go through edit mode, and waits for the write.
   *
   * The mutation API has no edit mode to enter (see `requiresNotebookEdit`), so its writes never set
   * `isEditing` and the change signal above ignores them. A write command that skips this does not save.
   *
   * It waits instead of leaving the save on the debounce because the caller reports an outcome: the
   * assistant tells someone their notebook was written, and only the finished request knows whether it
   * was. Throws when the save failed, so the caller can say that rather than claim a write that never
   * reached the server.
   */
  public async saveDocumentChange(): Promise<void> {
    // These writers hand over a whole document, so everything in the scene now is the notebook's own,
    // and whatever a reader had changed went with the scene this one replaced.
    this.timeSettingsEdited = true;
    for (const name of this.savedVizConfigs?.keys() ?? []) {
      this.vizConfigsEdited.add(name);
    }
    this.vizConfigsChangedWhileReading.clear();
    this.vizConfigsBeforeReadingChange.clear();
    this.editedByWriter = true;
    this.schedule();
    this.flush();

    // `flush` runs the save synchronously, so anything to write is already in flight by now. A save that
    // was already running when this arrived leaves this one queued behind it, and the queued one is the
    // one carrying the change, so waiting on a single request would return before it was written.
    while (this.inFlightSave) {
      await this.inFlightSave;
    }

    // Nothing is left in flight, so the status now says how it went. Still no error means the write
    // landed, or there was nothing to write and the notebook already holds what was asked for.
    if (this.state.status === 'error') {
      throw new Error(this.state.errorMessage ?? 'The notebook could not be saved.');
    }
  }

  /**
   * Marks the start of an editing session.
   *
   * A time range or a panel's look left behind by reading the notebook belongs to whoever was reading
   * it, so a session starts by disowning what is there and counts only the changes made from here on.
   */
  public notifyEditingStarted(): void {
    this.timeSettingsEdited = false;
    this.vizConfigsEdited.clear();
  }

  /**
   * The panels a reader changed and nobody has decided about yet. Empty means nothing to ask about.
   *
   * Counts only panels with a saved look to go back to, because offering to discard one without it
   * would answer the prompt by doing nothing.
   */
  public viewOnlyVizChanges(): string[] {
    const restorable = new Map<string, PanelKind['spec']['vizConfig']>();
    for (const { elementName, vizConfig } of this.restorablePanels()) {
      restorable.set(elementName, vizConfig);
    }

    const currentPanels = collectVizPanels(this.scene);
    const changes: string[] = [];
    for (const name of this.vizConfigsChangedWhileReading) {
      const savedVizConfig = restorable.get(name);
      const beforeChange = this.vizConfigsBeforeReadingChange.get(name);
      const currentPanel = currentPanels.get(name);
      const currentConfig = currentPanel && panelVizConfigState(currentPanel.state);
      if (beforeChange && this.vizConfigsEdited.has(name)) {
        beforeChange.wasEditedByWriter = true;
      }
      if (
        !savedVizConfig ||
        !beforeChange ||
        currentPanel !== beforeChange.panel ||
        !currentConfig ||
        isEqual(beforeChange.config, currentConfig)
      ) {
        this.vizConfigsChangedWhileReading.delete(name);
        this.vizConfigsBeforeReadingChange.delete(name);
      } else {
        changes.push(name);
      }
    }

    return changes;
  }

  /** Treats the named panels' current look as the notebook's own, so the next save writes it. */
  public keepVizChanges(elementNames: string[]): void {
    for (const name of elementNames) {
      this.vizConfigsEdited.add(name);
    }

    this.vizConfigsChangedWhileReading.clear();
    this.vizConfigsBeforeReadingChange.clear();
    // Set like any other edit, so a save that fails here is retried when the notebook is reopened.
    this.editedByWriter = true;
    this.schedule();
  }

  /**
   * Puts back the look from immediately before reading changed it. This is usually the saved look, but
   * can include an edit whose save failed. Goes through the panel's own setters rather than `setState`
   * because those also drop its cached processed data, which the old look would otherwise keep drawing.
   */
  public discardVizChanges(): void {
    let restoredWriterEdit = false;
    this.restoringVizConfigs = true;
    try {
      for (const { elementName, panel } of this.restorablePanels()) {
        const beforeChange = this.vizConfigsBeforeReadingChange.get(elementName);
        if (!this.vizConfigsChangedWhileReading.has(elementName) || !beforeChange || beforeChange.panel !== panel) {
          continue;
        }

        panel.onOptionsChange(beforeChange.config.options, true);
        panel.onFieldConfigChange(beforeChange.config.fieldConfig, true);
        if (beforeChange.wasEditedByWriter) {
          restoredWriterEdit = true;
          this.vizConfigsEdited.add(elementName);
        }
      }
    } finally {
      this.restoringVizConfigs = false;
    }

    this.vizConfigsChangedWhileReading.clear();
    this.vizConfigsBeforeReadingChange.clear();

    if (restoredWriterEdit) {
      this.editedByWriter = true;
      this.schedule();
    }
  }

  /**
   * The panels with a saved look to go back to. Skips one whose plugin has not loaded, because
   * restoring re-applies that plugin's defaults and an unrendered panel has nothing to restore.
   */
  private *restorablePanels() {
    const saved = this.savedVizConfigs;
    const savedPanels = this.savedVizPanels;
    if (!saved?.size || !savedPanels?.size) {
      return;
    }

    for (const cell of this.scene.state.body.state.cells) {
      const { elementName, body: panel } = cell.state;
      const vizConfig = saved.get(elementName);

      if (panel && panel === savedPanels.get(elementName) && vizConfig && panel.getPlugin()) {
        yield { elementName, panel, vizConfig };
      }
    }
  }

  /** Tries a failed save again. A failure waits for the next change, which may never come. */
  public retry(): void {
    this.schedule();
    this.flush();
  }

  /** Writes a pending save immediately, if there is one. */
  public flush(): void {
    this.scheduleSave.flush();
  }

  /**
   * Gives up on saving, for a notebook that is about to stop existing.
   *
   * Delete is the only caller. Without this, both the pending debounce and the teardown flush that
   * `start` returns would write the spec back to a resource the server has already removed, turning a
   * successful delete into a failed save. Cancelling the debounce alone would very nearly do, but the
   * change subscription can still fire while the scene tears down, so the flag is what makes it certain.
   *
   * A save already in flight is left to land; the delete simply follows it.
   */
  public abandon(): void {
    this.abandoned = true;
    this.scheduleSave.cancel();
    this.setState({ status: 'idle', errorMessage: undefined });
  }

  private stop(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.changeSub?.unsubscribe();
    this.changeSub = undefined;
    this.flush();
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flush();
    }
  };

  private scheduleSave = debounce(() => this.saveNow(), IDLE_BEFORE_SAVE_MS, { maxWait: MAX_WAIT_MS });

  private schedule(somethingToWrite = this.hasSomethingToWrite()): void {
    if (this.abandoned || !somethingToWrite) {
      return;
    }

    this.changePending = true;

    // Guarded so a keystroke does not publish state on every character.
    if (this.state.status !== 'pending') {
      this.setState({ status: 'pending' });
    }

    this.scheduleSave();
  }

  /**
   * Most state changes leave the saved notebook exactly as it is: opening a modal, a query finishing, a
   * reader moving their own time range. Scheduling those would have the notebook report unsaved changes
   * it does not have.
   */
  private hasSomethingToWrite(): boolean {
    // Already known to differ, so a keystroke does not pay for a comparison.
    if (this.state.status === 'pending') {
      return true;
    }

    // A save in flight leaves the baseline on the older spec, so an edit back to what the server is
    // about to hold would look like nothing to write when it is the next thing to write.
    if (this.inFlight) {
      return true;
    }

    // Serializing walks the whole scene, and a scene that cannot be serialized is a bug somewhere else.
    // Throwing here would report it in whatever changed the scene, which has nowhere to say so, and the
    // notebook would look fine while nothing saved. Assume there is work and let the save report it.
    try {
      return JSON.stringify(this.buildSpecToSave()) !== this.baseline;
    } catch {
      return true;
    }
  }

  /**
   * The spec a save would send: the scene as it is, except for the parts a reader owns rather than the
   * notebook, which stay as they were saved. Time settings are one, panel viz configs are the other.
   */
  private buildSpecToSave(
    timeSettingsEdited = this.timeSettingsEdited,
    vizConfigsEdited = this.vizConfigsEdited
  ): NotebookSpec {
    const spec = transformNotebookSceneToSaveModel(this.scene);
    const timeSettings = timeSettingsEdited || !this.savedTimeSettings ? spec.timeSettings : this.savedTimeSettings;

    return { ...spec, timeSettings, elements: this.withSavedVizConfigs(spec.elements, vizConfigsEdited) };
  }

  /**
   * Puts the saved viz config back on the panels nobody edited this session. One that was edited keeps
   * the scene's, and one added this session has nothing saved yet, so its own stands until it is.
   */
  private withSavedVizConfigs(
    elements: NotebookSpec['elements'],
    vizConfigsEdited: ReadonlySet<string>
  ): NotebookSpec['elements'] {
    const saved = this.savedVizConfigs;
    const savedPanels = this.savedVizPanels;
    if (!saved?.size || !savedPanels?.size) {
      return elements;
    }

    const currentPanels = collectVizPanels(this.scene);
    const result: Record<string, NotebookElement> = {};
    for (const [name, element] of Object.entries(elements)) {
      const savedVizConfig =
        !vizConfigsEdited.has(name) && currentPanels.get(name) === savedPanels.get(name) ? saved.get(name) : undefined;
      result[name] =
        element.kind === 'Panel' && savedVizConfig
          ? { ...element, spec: { ...element.spec, vizConfig: savedVizConfig } }
          : element;
    }

    return result;
  }

  /** Records a spec as one there is no longer any reason to write. */
  private recordWritten(
    spec: NotebookSpec,
    serialized = JSON.stringify(spec),
    panels = collectVizPanels(this.scene)
  ): void {
    this.baseline = serialized;
    this.savedTimeSettings = spec.timeSettings;
    this.savedVizConfigs = collectVizConfigs(spec);
    this.savedVizPanels = panels;
  }

  /** What to report when there is nothing waiting to be written. */
  private restingStatus(): NotebookSaveStatus {
    return this.hasSavedOnce ? 'saved' : 'idle';
  }

  private saveNow(): void {
    if (this.abandoned) {
      return;
    }

    // Two writes in flight can land out of order and let the older spec win.
    if (this.inFlight) {
      this.saveAgainWhenIdle = true;
      return;
    }

    this.changePending = false;

    const timeSettingsEdited = this.timeSettingsEdited;
    const vizConfigsEdited = new Set(this.vizConfigsEdited);
    const editedByWriter = this.editedByWriter;
    const panels = collectVizPanels(this.scene);

    let spec: NotebookSpec;
    let serialized: string;
    try {
      spec = this.buildSpecToSave(timeSettingsEdited, vizConfigsEdited);
      serialized = JSON.stringify(spec);
    } catch (error) {
      // `hasSomethingToWrite` leaves this for the save to report, because this is the one place with
      // somewhere to say it. A notebook whose spec cannot be built is not going to save.
      this.setState({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (serialized === this.baseline) {
      // Lots of things change the scene without changing what gets saved. Left on `pending`, the
      // notebook would go on saying it has unsaved changes when it has none. Clear the ownership flags
      // too: this can be a no-op queued behind an in-flight save, and leaving its flag set would let a
      // later view-only mutation ride in on reactivation as though a writer had made it.
      this.timeSettingsEdited = false;
      this.vizConfigsEdited.clear();
      this.editedByWriter = false;
      this.setState({ status: this.restingStatus() });
      return;
    }

    // From here these flags belong only to changes that arrive after this request starts. If the
    // request fails, its snapshot is merged back below so none of those earlier edits are lost.
    this.timeSettingsEdited = false;
    this.vizConfigsEdited.clear();
    this.editedByWriter = false;
    this.inFlight = true;
    this.setState({ status: 'saving', errorMessage: undefined });

    // Read here rather than at the top: a notebook with no uid has not been created yet, and its first
    // write is what creates it. Everything either branch does afterwards is the same.
    const { uid } = this.scene.state;

    this.inFlightSave = this.write(uid, spec)
      .then(({ generation }) => {
        this.recordWritten(spec, serialized, panels);
        this.hasSavedOnce = true;
        this.setState({
          // Something can have changed while this was in flight, and reporting it saved would claim
          // content that has not been written.
          status: this.changePending || this.saveAgainWhenIdle ? 'pending' : 'saved',
          errorMessage: undefined,
          // Only recorded when the server sent one. `NotebookPageStateManager` decides whether to reuse
          // its cached scene by comparing this, so a number we guessed could make it keep a stale one.
          ...(generation !== undefined ? { savedGeneration: generation } : {}),
        });
      })
      .catch((error) => {
        // Leave the baseline alone, so the next comparison still sees a difference and tries again.
        this.timeSettingsEdited ||= timeSettingsEdited;
        for (const name of vizConfigsEdited) {
          this.vizConfigsEdited.add(name);
        }
        this.editedByWriter ||= editedByWriter;
        this.setState({
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.inFlight = false;
        // Cleared before the queued save runs, so that save can record its own request here.
        this.inFlightSave = undefined;
        if (this.saveAgainWhenIdle) {
          this.saveAgainWhenIdle = false;
          this.saveNow();
        }
      });
  }

  /**
   * Writes the spec, creating the notebook if this is its first save.
   *
   * The uid is adopted onto the scene before this resolves, so a save queued behind this one updates the
   * notebook that was just created rather than creating a second. Only reached with something to write,
   * which is what stops a blank notebook nobody typed in from being created at all.
   */
  private write(uid: string | undefined, spec: NotebookSpec): Promise<{ generation?: number }> {
    if (uid) {
      return updateNotebook(uid, spec);
    }

    return createNotebook(spec).then(({ uid: created, generation }) => {
      this.adoptingUid = true;
      try {
        this.scene.setState({ uid: created });
      } finally {
        this.adoptingUid = false;
      }
      return { generation };
    });
  }
}

/**
 * The element whose viz config a state change just altered, if it was one. Matched back through the
 * cell, because the element name lives there and a VizPanel does not carry one.
 */
function changedVizConfigElement(payload: SceneObjectStateChangedPayload, scene: NotebookScene): string | undefined {
  const { changedObject, partialUpdate, prevState, newState } = payload;

  if (!('fieldConfig' in partialUpdate) && !('options' in partialUpdate)) {
    return undefined;
  }

  // A panel rewrites its own options and field config when its plugin loads, to apply that plugin's
  // defaults, and sets the plugin id and version in the same breath. Switching a panel to another
  // visualization is that same write, because `changePluginType` loads the new plugin to do it, so
  // the two cannot be told apart by what they set. Whether the id moved is what separates them.
  if (('pluginId' in partialUpdate || 'pluginVersion' in partialUpdate) && !changedPluginType(prevState, newState)) {
    return undefined;
  }

  return scene.state.body.state.cells.find((cell) => cell.state.body === changedObject)?.state.elementName;
}

/** Whether a panel state change swapped the panel's plugin, rather than loading the one it already had. */
function changedPluginType(prevState: SceneObjectState, newState: SceneObjectState): boolean {
  return 'pluginId' in prevState && 'pluginId' in newState && prevState.pluginId !== newState.pluginId;
}

/**
 * The viz config of every panel in a spec, by element name. Library panels are left out: they
 * serialize as a reference to the shared panel and carry no viz config of their own.
 */
function collectVizConfigs(spec: NotebookSpec): Map<string, PanelKind['spec']['vizConfig']> {
  const configs = new Map<string, PanelKind['spec']['vizConfig']>();

  for (const [name, element] of Object.entries(spec.elements)) {
    if (element.kind === 'Panel') {
      configs.set(name, element.spec.vizConfig);
    }
  }

  return configs;
}

/** The current panel instance for every element name, used to distinguish deletion and name reuse. */
function collectVizPanels(scene: NotebookScene): Map<string, VizPanel> {
  const panels = new Map<string, VizPanel>();

  for (const cell of scene.state.body.state.cells) {
    if (cell.state.body) {
      panels.set(cell.state.elementName, cell.state.body);
    }
  }

  return panels;
}

/** The panel state a reader can change without editing the notebook. */
function panelVizConfigState(state: SceneObjectState): PanelVizConfigState | undefined {
  if (!isVizPanelState(state)) {
    return undefined;
  }

  return {
    pluginId: state.pluginId,
    pluginVersion: state.pluginVersion,
    options: state.options,
    fieldConfig: state.fieldConfig,
  };
}

function isVizPanelState(state: SceneObjectState): state is VizPanel['state'] {
  return 'pluginId' in state && typeof state.pluginId === 'string' && 'options' in state && 'fieldConfig' in state;
}

/**
 * Whether a state change was a change to the notebook's time settings.
 *
 * `buildTimeSettingsSpec` reads them from these four places, so all four have to be named here: one left
 * out is one whose edits get thrown away as if a reader had made them.
 */
function changesTimeSettings(payload: SceneObjectStateChangedPayload, scene: NotebookScene): boolean {
  const { changedObject, partialUpdate } = payload;
  const { $timeRange, timePicker, refreshPicker } = scene.state;

  if (changedObject === scene) {
    return 'hideTimeControls' in partialUpdate;
  }

  return changedObject === $timeRange || changedObject === timePicker || changedObject === refreshPicker;
}
