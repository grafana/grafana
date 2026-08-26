import { debounce } from 'lodash';
import { type Unsubscribable } from 'rxjs';

import { SceneObjectStateChangedEvent, type SceneObjectStateChangedPayload } from '@grafana/scenes';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { updateNotebook } from '../api/notebookResource';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { type Spec as NotebookSpec } from '../types';

import { type NotebookScene } from './NotebookScene';

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
 * Changes only count while the notebook is being edited, and a time range only counts when it was changed
 * in that time: the time picker is there for readers too, and the range a reader picked is theirs, not the
 * range the notebook should open at for everyone. Writers that never enter edit mode call
 * `saveDocumentChange` instead.
 */
export class NotebookAutosave extends StateManagerBase<NotebookAutosaveState> {
  /** The spec we treat as already written: what the last save sent, or the notebook as it was loaded. */
  private baseline?: string;
  /** The time settings of `baseline`, sent again for as long as nobody has edited them. */
  private savedTimeSettings?: NotebookSpec['timeSettings'];
  /** Whether the time settings now in the scene are the notebook's own, rather than one reader's. */
  private timeSettingsEdited = false;
  private changeSub?: Unsubscribable;
  private inFlight = false;
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
    } else {
      // A scene is cached and reactivated when you come back to a notebook, so this can be the same
      // controller with edits that never reached the server. Waiting for a change that may never come
      // would lose them, and scheduling costs nothing when there is nothing to write.
      this.schedule();
    }

    this.changeSub = this.scene.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      if (!this.scene.state.isEditing) {
        return;
      }

      if (changesTimeSettings(payload, this.scene)) {
        this.timeSettingsEdited = true;
      }

      this.schedule();
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
    // These writers hand over a whole document, time settings included, so what is in the scene now is
    // the notebook's own.
    this.timeSettingsEdited = true;
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
   * A time range left behind by reading the notebook belongs to whoever was reading it, so a session
   * starts by disowning the one that is there and counts only the changes made from here on.
   */
  public notifyEditingStarted(): void {
    this.timeSettingsEdited = false;
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

  private schedule(): void {
    if (this.abandoned || !this.hasSomethingToWrite()) {
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
   * The spec a save would send: the scene as it is, except for time settings nobody has edited, which
   * stay as they were saved.
   */
  private buildSpecToSave(): NotebookSpec {
    const spec = transformNotebookSceneToSaveModel(this.scene);

    if (this.timeSettingsEdited || !this.savedTimeSettings) {
      return spec;
    }

    return { ...spec, timeSettings: this.savedTimeSettings };
  }

  /** Records a spec as one there is no longer any reason to write. */
  private recordWritten(spec: NotebookSpec, serialized = JSON.stringify(spec)): void {
    this.baseline = serialized;
    this.savedTimeSettings = spec.timeSettings;
    this.timeSettingsEdited = false;
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

    const { uid } = this.scene.state;
    if (!uid) {
      return;
    }

    this.changePending = false;

    let spec: NotebookSpec;
    let serialized: string;
    try {
      spec = this.buildSpecToSave();
      serialized = JSON.stringify(spec);
    } catch (error) {
      // `hasSomethingToWrite` leaves this for the save to report, because this is the one place with
      // somewhere to say it. A notebook whose spec cannot be built is not going to save.
      this.setState({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (serialized === this.baseline) {
      // Lots of things change the scene without changing what gets saved. Left on `pending`, the
      // notebook would go on saying it has unsaved changes when it has none.
      this.setState({ status: this.restingStatus() });
      return;
    }

    this.inFlight = true;
    this.setState({ status: 'saving', errorMessage: undefined });

    this.inFlightSave = updateNotebook(uid, spec)
      .then(({ generation }) => {
        this.recordWritten(spec, serialized);
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
