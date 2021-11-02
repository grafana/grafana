import { __read, __spreadArray } from "tslib";
import { debounce, memoize } from 'lodash';
export default (function (func, wait) {
    if (wait === void 0) { wait = 7000; }
    var mem = memoize(function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return debounce(func, wait, {
            leading: true,
        });
    }, function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return JSON.stringify(args);
    });
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return mem.apply(void 0, __spreadArray([], __read(args), false)).apply(void 0, __spreadArray([], __read(args), false));
    };
});
//# sourceMappingURL=memoizedDebounce.js.map