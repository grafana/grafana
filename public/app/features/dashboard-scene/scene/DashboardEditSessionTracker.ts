import { DashboardInteractions } from '../utils/interactions';

import type { DashboardScene } from './DashboardScene';

/**
 * Tracks edit sessions the assistant participated in, to measure how often they end up saved.
 *
 * A session opens on the first assistant edit (a successful Mutation API write) and emits
 * `editSessionStarted` — the denominator. On save, the assistant edit count is read and reported
 * on the dashboard save event (`assistant_edit_count`); saves with a non-zero count are the numerator. A
 * session that is discarded or abandoned (tab closed) is closed without a save, so it counts as not saved.
 */
export class DashboardEditSessionTracker {
  private _active = false;
  private _assistantEditCount = 0;

  public constructor(private _dashboard: DashboardScene) {}

  /** Called by DashboardMutationClient on each successful assistant write. Opens the session on the first one. */
  public recordAssistantEdit() {
    if (!this._active) {
      this._active = true;
      this._assistantEditCount = 0;
      DashboardInteractions.editSessionStarted({ dashboard_uid: this._dashboard.state.uid });
    }

    this._assistantEditCount += 1;
  }

  /** Number of assistant edits in the current session. Reported on the dashboard save event. */
  public getAssistantEditCount(): number {
    return this._assistantEditCount;
  }

  /** Closes the session. Called when it ends — saved, discarded, or discard-and-keep-editing. */
  public reset() {
    this._active = false;
    this._assistantEditCount = 0;
  }
}
