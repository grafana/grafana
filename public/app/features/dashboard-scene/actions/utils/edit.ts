import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from '../../sidebar/events';

/**
 * Registers and performs an edit action
 */
export function edit(props: DashboardEditActionEventPayload) {
  props.source.publishEvent(new DashboardEditActionEvent(props), true);
}
