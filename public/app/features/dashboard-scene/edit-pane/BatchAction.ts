import { type SceneObject } from '@grafana/scenes';

import { type DashboardEditActionEventPayload } from './events';

/**
 * Groups several edit actions into a single undo/redo unit.
 *
 * A batch is created by `dashboardEditActions.batch(...)` and dispatched like any
 * other edit action (it carries a `source`). While it is the active batch
 * (`inProgress === true` and it's the top of the undo stack) any edit actions
 * published during the batch closure are performed and collected here instead of
 * being pushed onto the undo stack individually. The batch itself is the single
 * entry on the stack.
 *
 * - `perform` (redo) replays the collected actions in order.
 * - `undo` reverses them in the opposite order.
 *
 * Selection metadata is derived from the collected actions so the edit pane can
 * restore selection on undo/redo just like it does for a single action.
 */
export class BatchAction implements DashboardEditActionEventPayload {
  /** True while the batch closure is running and actions are being collected. */
  public inProgress = false;

  private actions: DashboardEditActionEventPayload[] = [];

  public constructor(
    public readonly source: SceneObject,
    public readonly description: string
  ) {}

  public add(action: DashboardEditActionEventPayload): void {
    this.actions.push(action);
  }

  public isEmpty(): boolean {
    return this.actions.length === 0;
  }

  public perform = (): void => {
    this.actions.forEach((action) => action.perform());
  };

  public undo = (): void => {
    [...this.actions].reverse().forEach((action) => action.undo());
  };

  public get addedObject(): SceneObject | undefined {
    return [...this.actions].reverse().find((action) => action.addedObject)?.addedObject;
  }

  public get removedObject(): SceneObject | undefined {
    return this.actions.find((action) => action.removedObject)?.removedObject;
  }

  public get movedObject(): SceneObject | undefined {
    return this.actions.find((action) => action.movedObject)?.movedObject;
  }
}
