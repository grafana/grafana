import { __extends } from "tslib";
import { BusEventBase, BusEventWithPayload, eventFactory } from '@grafana/data';
/**
 * Events
 */
export var dsRequestResponse = eventFactory('ds-request-response');
export var dsRequestError = eventFactory('ds-request-error');
export var toggleSidemenuMobile = eventFactory('toggle-sidemenu-mobile');
export var toggleSidemenuHidden = eventFactory('toggle-sidemenu-hidden');
export var templateVariableValueUpdated = eventFactory('template-variable-value-updated');
export var graphClicked = eventFactory('graph-click');
/**
 * @internal
 */
export var thresholdChanged = eventFactory('threshold-changed');
/**
 * Used for syncing queries badge count in panel edit queries tab
 * Think we can get rid of this soon
 */
var PanelQueriesChangedEvent = /** @class */ (function (_super) {
    __extends(PanelQueriesChangedEvent, _super);
    function PanelQueriesChangedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelQueriesChangedEvent.type = 'panel-queries-changed';
    return PanelQueriesChangedEvent;
}(BusEventBase));
export { PanelQueriesChangedEvent };
/**
 * Used for syncing transformations badge count in panel edit transform tab
 * Think we can get rid of this soon
 */
var PanelTransformationsChangedEvent = /** @class */ (function (_super) {
    __extends(PanelTransformationsChangedEvent, _super);
    function PanelTransformationsChangedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelTransformationsChangedEvent.type = 'panel-transformations-changed';
    return PanelTransformationsChangedEvent;
}(BusEventBase));
export { PanelTransformationsChangedEvent };
/**
 * Used by panel editor to know when panel plugin it'self trigger option updates
 */
var PanelOptionsChangedEvent = /** @class */ (function (_super) {
    __extends(PanelOptionsChangedEvent, _super);
    function PanelOptionsChangedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelOptionsChangedEvent.type = 'panels-options-changed';
    return PanelOptionsChangedEvent;
}(BusEventBase));
export { PanelOptionsChangedEvent };
/**
 * Used internally by DashboardModel to commmunicate with DashboardGrid that it needs to re-render
 */
var DashboardPanelsChangedEvent = /** @class */ (function (_super) {
    __extends(DashboardPanelsChangedEvent, _super);
    function DashboardPanelsChangedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DashboardPanelsChangedEvent.type = 'dashboard-panels-changed';
    return DashboardPanelsChangedEvent;
}(BusEventBase));
export { DashboardPanelsChangedEvent };
var PanelDirectiveReadyEvent = /** @class */ (function (_super) {
    __extends(PanelDirectiveReadyEvent, _super);
    function PanelDirectiveReadyEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelDirectiveReadyEvent.type = 'panel-directive-ready';
    return PanelDirectiveReadyEvent;
}(BusEventBase));
export { PanelDirectiveReadyEvent };
var RenderEvent = /** @class */ (function (_super) {
    __extends(RenderEvent, _super);
    function RenderEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RenderEvent.type = 'render';
    return RenderEvent;
}(BusEventBase));
export { RenderEvent };
var ZoomOutEvent = /** @class */ (function (_super) {
    __extends(ZoomOutEvent, _super);
    function ZoomOutEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ZoomOutEvent.type = 'zoom-out';
    return ZoomOutEvent;
}(BusEventWithPayload));
export { ZoomOutEvent };
export var ShiftTimeEventPayload;
(function (ShiftTimeEventPayload) {
    ShiftTimeEventPayload[ShiftTimeEventPayload["Left"] = -1] = "Left";
    ShiftTimeEventPayload[ShiftTimeEventPayload["Right"] = 1] = "Right";
})(ShiftTimeEventPayload || (ShiftTimeEventPayload = {}));
var ShiftTimeEvent = /** @class */ (function (_super) {
    __extends(ShiftTimeEvent, _super);
    function ShiftTimeEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ShiftTimeEvent.type = 'shift-time';
    return ShiftTimeEvent;
}(BusEventWithPayload));
export { ShiftTimeEvent };
var RemovePanelEvent = /** @class */ (function (_super) {
    __extends(RemovePanelEvent, _super);
    function RemovePanelEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RemovePanelEvent.type = 'remove-panel';
    return RemovePanelEvent;
}(BusEventWithPayload));
export { RemovePanelEvent };
/**
 * @deprecated use ShowModalReactEvent instead that has this capability built in
 */
var ShowModalEvent = /** @class */ (function (_super) {
    __extends(ShowModalEvent, _super);
    function ShowModalEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ShowModalEvent.type = 'show-modal';
    return ShowModalEvent;
}(BusEventWithPayload));
export { ShowModalEvent };
var ShowConfirmModalEvent = /** @class */ (function (_super) {
    __extends(ShowConfirmModalEvent, _super);
    function ShowConfirmModalEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ShowConfirmModalEvent.type = 'show-confirm-modal';
    return ShowConfirmModalEvent;
}(BusEventWithPayload));
export { ShowConfirmModalEvent };
var ShowModalReactEvent = /** @class */ (function (_super) {
    __extends(ShowModalReactEvent, _super);
    function ShowModalReactEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ShowModalReactEvent.type = 'show-react-modal';
    return ShowModalReactEvent;
}(BusEventWithPayload));
export { ShowModalReactEvent };
/**
 * @deprecated use ShowModalReactEvent instead that has this capability built in
 */
var HideModalEvent = /** @class */ (function (_super) {
    __extends(HideModalEvent, _super);
    function HideModalEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    HideModalEvent.type = 'hide-modal';
    return HideModalEvent;
}(BusEventBase));
export { HideModalEvent };
var DashboardSavedEvent = /** @class */ (function (_super) {
    __extends(DashboardSavedEvent, _super);
    function DashboardSavedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DashboardSavedEvent.type = 'dashboard-saved';
    return DashboardSavedEvent;
}(BusEventBase));
export { DashboardSavedEvent };
var AnnotationQueryStarted = /** @class */ (function (_super) {
    __extends(AnnotationQueryStarted, _super);
    function AnnotationQueryStarted() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AnnotationQueryStarted.type = 'annotation-query-started';
    return AnnotationQueryStarted;
}(BusEventWithPayload));
export { AnnotationQueryStarted };
var AnnotationQueryFinished = /** @class */ (function (_super) {
    __extends(AnnotationQueryFinished, _super);
    function AnnotationQueryFinished() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AnnotationQueryFinished.type = 'annotation-query-finished';
    return AnnotationQueryFinished;
}(BusEventWithPayload));
export { AnnotationQueryFinished };
var PanelEditEnteredEvent = /** @class */ (function (_super) {
    __extends(PanelEditEnteredEvent, _super);
    function PanelEditEnteredEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelEditEnteredEvent.type = 'panel-edit-started';
    return PanelEditEnteredEvent;
}(BusEventWithPayload));
export { PanelEditEnteredEvent };
var PanelEditExitedEvent = /** @class */ (function (_super) {
    __extends(PanelEditExitedEvent, _super);
    function PanelEditExitedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelEditExitedEvent.type = 'panel-edit-finished';
    return PanelEditExitedEvent;
}(BusEventWithPayload));
export { PanelEditExitedEvent };
//# sourceMappingURL=events.js.map