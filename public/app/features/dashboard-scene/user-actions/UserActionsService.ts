import { DashboardEditActionEvent } from '../edit-pane/events';
import type { DashboardScene } from '../scene/DashboardScene';

import type { UserActionCommand } from './UserActionCommand';

export interface UserActionExecuteResult {
  success: boolean;
  error?: string;
  /**
   * True when the targeted object is currently write-locked. Caller should
   * wait and retry. Reads via Scenes subscriptions are not affected.
   */
  locked: boolean;
}

/**
 * Central service for all reversible dashboard mutations.
 *
 * Owns the undo/redo stack. Both the UI (direct calls) and the agent
 * (via MutationApiClient -> ClientCommand) funnel through this service,
 * making it the single permission-check + lock + locking choke point.
 *
 * Bridges to DashboardEditActionEvent so the existing toolbar undo/redo
 * button continues to function while DashboardEditPane is gradually migrated
 * to read from this service directly.
 */
export class UserActionsService {
  private scene: DashboardScene;
  private _undoStack: UserActionCommand[] = [];
  private _redoStack: UserActionCommand[] = [];

  constructor(scene: DashboardScene) {
    this.scene = scene;
  }

  execute(cmd: UserActionCommand): UserActionExecuteResult {
    if (!this.scene.canEditDashboard()) {
      return {
        success: false,
        error: 'Cannot edit dashboard: insufficient permissions or dashboard is a snapshot',
        locked: false,
      };
    }

    if (cmd.lockTarget && this.scene.isWriteLocked(cmd.lockTarget)) {
      return {
        success: false,
        locked: true,
        error: `Target '${cmd.lockTarget}' is locked`,
      };
    }

    try {
      cmd.perform();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        locked: false,
      };
    }

    this._undoStack.push(cmd);
    this._redoStack = [];
    this.scene.forceRender();

    // Bridge to the existing toolbar undo stack via DashboardEditActionEvent.
    // The mutation has already been applied here, so on the initial publish the
    // perform callback is a no-op; on redo (the second time perform is called)
    // it re-applies cmd.perform().
    let firstPerform = true;
    this.scene.publishEvent(
      new DashboardEditActionEvent({
        source: this.scene,
        description: cmd.title,
        perform: () => {
          if (firstPerform) {
            firstPerform = false;
            return;
          }
          cmd.perform();
        },
        undo: () => cmd.undo(),
      }),
      true
    );

    return { success: true, locked: false };
  }

  undo(): boolean {
    const cmd = this._undoStack.pop();
    if (!cmd) {
      return false;
    }
    cmd.undo();
    this._redoStack.push(cmd);
    this.scene.forceRender();
    return true;
  }

  redo(): boolean {
    const cmd = this._redoStack.pop();
    if (!cmd) {
      return false;
    }
    cmd.perform();
    this._undoStack.push(cmd);
    this.scene.forceRender();
    return true;
  }

  peekUndoTitle(): string | undefined {
    return this._undoStack[this._undoStack.length - 1]?.title;
  }

  peekRedoTitle(): string | undefined {
    return this._redoStack[this._redoStack.length - 1]?.title;
  }
}
