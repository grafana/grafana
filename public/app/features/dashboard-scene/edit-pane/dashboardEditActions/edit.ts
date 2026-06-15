import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from '../events';

/**
 * Registers and performs an edit action.
 *
 * This is the low-level primitive every other action is built on: it publishes a
 * DashboardEditActionEvent which DashboardEditPane picks up to perform the change
 * and push it onto the undo stack.
 */
export function edit(props: DashboardEditActionEventPayload) {
  props.source.publishEvent(new DashboardEditActionEvent(props), true);
}
