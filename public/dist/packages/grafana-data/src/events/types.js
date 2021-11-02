import { __extends } from "tslib";
/**
 * @alpha
 * Base event type
 */
var BusEventBase = /** @class */ (function () {
    function BusEventBase() {
        //@ts-ignore
        this.type = this.__proto__.constructor.type;
    }
    return BusEventBase;
}());
export { BusEventBase };
/**
 * @alpha
 * Base event type with payload
 */
var BusEventWithPayload = /** @class */ (function (_super) {
    __extends(BusEventWithPayload, _super);
    function BusEventWithPayload(payload) {
        var _this = _super.call(this) || this;
        _this.payload = payload;
        return _this;
    }
    return BusEventWithPayload;
}(BusEventBase));
export { BusEventWithPayload };
//# sourceMappingURL=types.js.map