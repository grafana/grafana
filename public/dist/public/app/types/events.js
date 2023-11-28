import { BusEventBase, BusEventWithPayload, eventFactory } from '@grafana/data';
/**
 * Events
 */
export const dsRequestResponse = eventFactory('ds-request-response');
export const dsRequestError = eventFactory('ds-request-error');
export const templateVariableValueUpdated = eventFactory('template-variable-value-updated');
export const graphClicked = eventFactory('graph-click');
/**
 * @internal
 */
export const thresholdChanged = eventFactory('threshold-changed');
/**
 * Used for syncing queries badge count in panel edit queries tab
 * Think we can get rid of this soon
 */
export class PanelQueriesChangedEvent extends BusEventBase {
}
PanelQueriesChangedEvent.type = 'panel-queries-changed';
/**
 * Used for syncing transformations badge count in panel edit transform tab
 * Think we can get rid of this soon
 */
export class PanelTransformationsChangedEvent extends BusEventBase {
}
PanelTransformationsChangedEvent.type = 'panel-transformations-changed';
/**
 * Used by panel editor to know when panel plugin itself trigger option updates
 */
export class PanelOptionsChangedEvent extends BusEventBase {
}
PanelOptionsChangedEvent.type = 'panels-options-changed';
/**
 * Used internally by DashboardModel to communicate with DashboardGrid that it needs to re-render
 */
export class DashboardPanelsChangedEvent extends BusEventBase {
}
DashboardPanelsChangedEvent.type = 'dashboard-panels-changed';
export class DashboardMetaChangedEvent extends BusEventBase {
}
DashboardMetaChangedEvent.type = 'dashboard-meta-changed';
export class PanelDirectiveReadyEvent extends BusEventBase {
}
PanelDirectiveReadyEvent.type = 'panel-directive-ready';
export class RenderEvent extends BusEventBase {
}
RenderEvent.type = 'render';
export class ZoomOutEvent extends BusEventWithPayload {
}
ZoomOutEvent.type = 'zoom-out';
export var ShiftTimeEventDirection;
(function (ShiftTimeEventDirection) {
    ShiftTimeEventDirection[ShiftTimeEventDirection["Left"] = -1] = "Left";
    ShiftTimeEventDirection[ShiftTimeEventDirection["Right"] = 1] = "Right";
})(ShiftTimeEventDirection || (ShiftTimeEventDirection = {}));
export class ShiftTimeEvent extends BusEventWithPayload {
}
ShiftTimeEvent.type = 'shift-time';
export class AbsoluteTimeEvent extends BusEventWithPayload {
}
AbsoluteTimeEvent.type = 'absolute-time';
export class RemovePanelEvent extends BusEventWithPayload {
}
RemovePanelEvent.type = 'remove-panel';
/**
 * @deprecated use ShowModalReactEvent instead that has this capability built in
 */
export class ShowModalEvent extends BusEventWithPayload {
}
ShowModalEvent.type = 'show-modal';
export class ShowConfirmModalEvent extends BusEventWithPayload {
}
ShowConfirmModalEvent.type = 'show-confirm-modal';
export class ShowModalReactEvent extends BusEventWithPayload {
}
ShowModalReactEvent.type = 'show-react-modal';
/**
 * @deprecated use ShowModalReactEvent instead that has this capability built in
 */
export class HideModalEvent extends BusEventBase {
}
HideModalEvent.type = 'hide-modal';
export class DashboardSavedEvent extends BusEventBase {
}
DashboardSavedEvent.type = 'dashboard-saved';
export class AnnotationQueryStarted extends BusEventWithPayload {
}
AnnotationQueryStarted.type = 'annotation-query-started';
export class AnnotationQueryFinished extends BusEventWithPayload {
}
AnnotationQueryFinished.type = 'annotation-query-finished';
export class PanelEditEnteredEvent extends BusEventWithPayload {
}
PanelEditEnteredEvent.type = 'panel-edit-started';
export class PanelEditExitedEvent extends BusEventWithPayload {
}
PanelEditExitedEvent.type = 'panel-edit-finished';
//# sourceMappingURL=events.js.map