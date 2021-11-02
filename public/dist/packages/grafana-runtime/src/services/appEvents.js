import { __extends } from "tslib";
import { BusEventBase, BusEventWithPayload } from '@grafana/data';
/**
 * Called when a dashboard is refreshed
 *
 * @public
 */
var RefreshEvent = /** @class */ (function (_super) {
    __extends(RefreshEvent, _super);
    function RefreshEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RefreshEvent.type = 'refresh';
    return RefreshEvent;
}(BusEventBase));
export { RefreshEvent };
/**
 * Called when the theme settings change
 *
 * @public
 */
var ThemeChangedEvent = /** @class */ (function (_super) {
    __extends(ThemeChangedEvent, _super);
    function ThemeChangedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ThemeChangedEvent.type = 'theme-changed';
    return ThemeChangedEvent;
}(BusEventWithPayload));
export { ThemeChangedEvent };
/**
 * Called when time range is updated
 *
 * @public
 */
var TimeRangeUpdatedEvent = /** @class */ (function (_super) {
    __extends(TimeRangeUpdatedEvent, _super);
    function TimeRangeUpdatedEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TimeRangeUpdatedEvent.type = 'time-range-updated';
    return TimeRangeUpdatedEvent;
}(BusEventWithPayload));
export { TimeRangeUpdatedEvent };
/**
 * Called to copy a panel JSON into local storage
 *
 * @public
 */
var CopyPanelEvent = /** @class */ (function (_super) {
    __extends(CopyPanelEvent, _super);
    function CopyPanelEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CopyPanelEvent.type = 'copy-panel';
    return CopyPanelEvent;
}(BusEventWithPayload));
export { CopyPanelEvent };
// Internal singleton instance
var singletonInstance;
/**
 * Used during startup by Grafana to set the LocationSrv so it is available
 * via the {@link getLocationSrv} to the rest of the application.
 *
 * @internal
 */
export function setAppEvents(instance) {
    singletonInstance = instance;
}
/**
 * Used to retrieve an event bus that manages application level events
 *
 * @public
 */
export function getAppEvents() {
    return singletonInstance;
}
//# sourceMappingURL=appEvents.js.map