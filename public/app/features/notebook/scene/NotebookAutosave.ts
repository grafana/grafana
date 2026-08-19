import { debounce } from 'lodash';
import { type Unsubscribable } from 'rxjs';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { updateNotebook } from '../api/notebookResource';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';

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
 * Changes only count while the notebook is being edited. Time settings are part of what gets saved and the
 * time picker is there for readers too, so counting a reader's change would save their time range as the
 * notebook's own. Writers that never enter edit mode call `notifyDocumentChanged` instead.
 */
export class NotebookAutosave extends StateManagerBase<NotebookAutosaveState> {
  private lastSaved?: string;
  private changeSub?: Unsubscribable;
  private inFlight = false;
  private saveAgainWhenIdle = false;
  private changePending = false;
  private hasSavedOnce = false;

  public constructor(private scene: NotebookScene) {
    super({ status: 'idle' });
  }

  /** Begins watching for changes. Returns the teardown, which flushes anything still pending. */
  public start(): () => void {
    // Entering edit mode publishes state changes of its own, so without a baseline the first comparison
    // would write the notebook straight back unchanged.
    this.lastSaved = JSON.stringify(transformNotebookSceneToSaveModel(this.scene));

    this.changeSub = this.scene.subscribeToEvent(SceneObjectStateChangedEvent, () => {
      if (!this.scene.state.isEditing) {
        return;
      }

      this.schedule();
    });

    // Not beforeunload: adding an unload listener stops the browser reusing the page when you navigate
    // back, for everyone. Going hidden is the last thing a page is sure to see before it disappears.
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    return () => this.stop();
  }

  /**
   * Schedules a save for a writer that does not go through edit mode.
   *
   * The mutation API has no edit mode to enter (see `requiresNotebookEdit`), so its writes never set
   * `isEditing` and the change signal above ignores them. A write command that skips this does not save.
   */
  public notifyDocumentChanged(): void {
    this.schedule();
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
    this.changePending = true;

    // Guarded so a keystroke does not publish state on every character.
    if (this.state.status !== 'pending') {
      this.setState({ status: 'pending' });
    }

    this.scheduleSave();
  }

  /** What to report when there is nothing waiting to be written. */
  private restingStatus(): NotebookSaveStatus {
    return this.hasSavedOnce ? 'saved' : 'idle';
  }

  private saveNow(): void {
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

    const spec = transformNotebookSceneToSaveModel(this.scene);
    const serialized = JSON.stringify(spec);
    if (serialized === this.lastSaved) {
      // Lots of things change the scene without changing what gets saved. Left on `pending`, the
      // notebook would go on saying it has unsaved changes when it has none.
      this.setState({ status: this.restingStatus() });
      return;
    }

    this.inFlight = true;
    this.setState({ status: 'saving', errorMessage: undefined });

    updateNotebook(uid, spec)
      .then(({ generation }) => {
        this.lastSaved = serialized;
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
        // Leave `lastSaved` alone, so the next comparison still sees a difference and tries again.
        this.setState({
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.inFlight = false;
        if (this.saveAgainWhenIdle) {
          this.saveAgainWhenIdle = false;
          this.saveNow();
        }
      });
  }
}
