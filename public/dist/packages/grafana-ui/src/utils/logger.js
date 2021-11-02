import { __read, __spreadArray } from "tslib";
import { throttle } from 'lodash';
/**
 * @internal
 * */
var throttledLog = throttle(function () {
    var t = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        t[_i] = arguments[_i];
    }
    console.log.apply(console, __spreadArray([], __read(t), false));
}, 500);
/** @internal */
export var createLogger = function (name) {
    var LOGGIN_ENABLED = false;
    return {
        logger: function (id, throttle) {
            if (throttle === void 0) { throttle = false; }
            var t = [];
            for (var _i = 2; _i < arguments.length; _i++) {
                t[_i - 2] = arguments[_i];
            }
            if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || !LOGGIN_ENABLED) {
                return;
            }
            var fn = throttle ? throttledLog : console.log;
            fn.apply(void 0, __spreadArray(["[" + name + ": " + id + "]: "], __read(t), false));
        },
        enable: function () { return (LOGGIN_ENABLED = true); },
        disable: function () { return (LOGGIN_ENABLED = false); },
        isEnabled: function () { return LOGGIN_ENABLED; },
    };
};
//# sourceMappingURL=logger.js.map