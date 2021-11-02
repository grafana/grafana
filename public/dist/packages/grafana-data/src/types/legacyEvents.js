import { __extends } from "tslib";
import { eventFactory } from '../events/eventFactory';
import { BusEventBase, BusEventWithPayload } from '../events/types';
export var AppEvents = {
    alertSuccess: eventFactory('alert-success'),
    alertWarning: eventFactory('alert-warning'),
    alertError: eventFactory('alert-error'),
};
export var PanelEvents = {
    refresh: eventFactory('refresh'),
    componentDidMount: eventFactory('component-did-mount'),
    dataReceived: eventFactory('data-received'),
    dataError: eventFactory('data-error'),
    dataFramesReceived: eventFactory('data-frames-received'),
    dataSnapshotLoad: eventFactory('data-snapshot-load'),
    editModeInitialized: eventFactory('init-edit-mode'),
    initPanelActions: eventFactory('init-panel-actions'),
    initialized: eventFactory('panel-initialized'),
    panelTeardown: eventFactory('panel-teardown'),
    render: eventFactory('render'),
};
/** @alpha */
var LegacyGraphHoverEvent = /** @class */ (function (_super) {
    __extends(LegacyGraphHoverEvent, _super);
    function LegacyGraphHoverEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LegacyGraphHoverEvent.type = 'graph-hover';
    return LegacyGraphHoverEvent;
}(BusEventWithPayload));
export { LegacyGraphHoverEvent };
/** @alpha */
var LegacyGraphHoverClearEvent = /** @class */ (function (_super) {
    __extends(LegacyGraphHoverClearEvent, _super);
    function LegacyGraphHoverClearEvent() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.payload = { point: {} };
        return _this;
    }
    LegacyGraphHoverClearEvent.type = 'graph-hover-clear';
    return LegacyGraphHoverClearEvent;
}(BusEventBase));
export { LegacyGraphHoverClearEvent };
//# sourceMappingURL=legacyEvents.js.map