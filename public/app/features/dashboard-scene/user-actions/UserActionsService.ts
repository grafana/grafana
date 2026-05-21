import type { DashboardScene } from '../scene/DashboardScene';

import type { UserActionCommand } from './UserActionCommand';

export interface UserActionExecuteResult {
  success: boolean;
  error?: string;
  /**
   * Future locking signal. When true the targeted object is under concurrent
   * use and the caller should wait and retry. Always false in this POC.
   */
  locked: false;
}

/**
 * Central service for all reversible dashboard mutations.
 *
 * Owns the undo/redo stack. Both the UI (direct calls) and the agent
 * (via MutationApiClient → ClientCommand) funnel through this service,
 * making it the single permission-check and locking choke point.
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
