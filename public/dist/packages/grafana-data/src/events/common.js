import { __extends } from "tslib";
import { BusEventBase, BusEventWithPayload } from './types';
/** @alpha */
var DataHoverEvent = /** @class */ (function (_super) {
    __extends(DataHoverEvent, _super);
    function DataHoverEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataHoverEvent.type = 'data-hover';
    return DataHoverEvent;
}(BusEventWithPayload));
export { DataHoverEvent };
/** @alpha */
var DataHoverClearEvent = /** @class */ (function (_super) {
    __extends(DataHoverClearEvent, _super);
    function DataHoverClearEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataHoverClearEvent.type = 'data-hover-clear';
    return DataHoverClearEvent;
}(BusEventBase));
export { DataHoverClearEvent };
/** @alpha */
var DataSelectEvent = /** @class */ (function (_super) {
    __extends(DataSelectEvent, _super);
    function DataSelectEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataSelectEvent.type = 'data-select';
    return DataSelectEvent;
}(BusEventWithPayload));
export { DataSelectEvent };
/** @alpha */
var AnnotationChangeEvent = /** @class */ (function (_super) {
    __extends(AnnotationChangeEvent, _super);
    function AnnotationChangeEvent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AnnotationChangeEvent.type = 'annotation-event';
    return AnnotationChangeEvent;
}(BusEventWithPayload));
export { AnnotationChangeEvent };
//# sourceMappingURL=common.js.map