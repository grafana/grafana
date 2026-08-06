import { type SceneObject, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { type ElementSelectionOnSelectOptions } from '@grafana/ui';

import {
  DashboardEditActionEvent,
  type DashboardEditActionEventPayload,
  DashboardStateChangedEvent,
} from '../sidebar/events';

/**
 * Selection-side effects the undo/redo engine needs from its host (today: DashboardSidebar).
 * Optional so the history can be unit-tested without a full sidebar.
 */
export interface DashboardEditActionsHistoryHost {
  onObjectAdded(obj: SceneObject): void;
  clearSelection(): void;
  selectObject(obj: SceneObject, options?: ElementSelectionOnSelectOptions): void;
  getSelectedObject(): SceneObject | undefined;
  fixSelectionOfRemovedObject(): void;
}

export interface DashboardEditActionsHistoryState extends SceneObjectState {
  undoStack: DashboardEditActionEventPayload[];
  redoStack: DashboardEditActionEventPayload[];
}

/**
 * Owns the undo/redo stacks and the DashboardEditActionEvent handler.
 * Selection effects are delegated to an optional host so this can live outside DashboardSidebar.
 */
export class DashboardEditActionsHistory extends SceneObjectBase<DashboardEditActionsHistoryState> {
  private host?: DashboardEditActionsHistoryHost;

  public constructor(state?: Partial<DashboardEditActionsHistoryState>) {
    super({
      undoStack: [],
      redoStack: [],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public setHost(host: DashboardEditActionsHistoryHost) {
    this.host = host;
  }

  public clone(withState?: Partial<DashboardEditActionsHistoryState>): this {
    // Fresh history — never carry stacks across clones
    return super.clone({ ...withState, undoStack: [], redoStack: [] });
  }

  private onActivate() {
    // Subscribe on the root so we stay independent of DashboardScene specifically.
    // publishEvent(event, true) bubbles to every ancestor, so the root sees all edit actions.
    const root = this.getRoot();
    this._subs.add(
      root.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
        this.handleEditAction(payload);
      })
    );
  }

  private handleEditAction(action: DashboardEditActionEventPayload) {
    // Clear redo stack when user performs a new action
    // Otherwise things can get into very broken states
    if (this.state.redoStack.length > 0) {
      this.setState({ redoStack: [] });
    }

    this.performAction(action);

    this.setState({ undoStack: [...this.state.undoStack, action] });
  }

  public undoAction() {
    const undoStack = this.state.undoStack.slice();
    const action = undoStack.pop();
    if (!action) {
      return;
    }

    action.undo();
    action.source.publishEvent(new DashboardStateChangedEvent({ source: action.source }), true);

    if (action.addedObject) {
      this.host?.clearSelection();
    }

    if (action.movedObject) {
      this.host?.selectObject(action.movedObject, { force: true });
    }

    if (action.removedObject) {
      this.host?.onObjectAdded(action.removedObject);
    }

    this.setState({ undoStack, redoStack: [...this.state.redoStack, action] });
  }

  public redoAction() {
    const redoStack = this.state.redoStack.slice();
    const action = redoStack.pop();
    if (!action) {
      return;
    }

    this.performAction(action);

    this.setState({ redoStack, undoStack: [...this.state.undoStack, action] });
  }

  private performAction(action: DashboardEditActionEventPayload) {
    action.perform();
    action.source.publishEvent(new DashboardStateChangedEvent({ source: action.source }), true);

    if (action.addedObject) {
      this.host?.onObjectAdded(action.addedObject);
    }

    if (action.movedObject) {
      this.host?.selectObject(action.movedObject, { force: true });
    }

    // If action removed an object and not added a new one we need to update selection
    if (action.removedObject && !action.addedObject) {
      if (action.removedObject === this.host?.getSelectedObject()) {
        this.host?.fixSelectionOfRemovedObject();
      }
    }
  }
}
