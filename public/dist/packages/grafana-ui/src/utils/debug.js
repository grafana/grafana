import { __assign } from "tslib";
/**
 * Allows debug helpers attachement to the window object
 * @internal
 */
export function attachDebugger(key, thebugger, logger) {
    var _a;
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    var completeDebugger = thebugger || {};
    if (logger !== undefined) {
        completeDebugger = __assign(__assign({}, completeDebugger), { enable: function () { return logger.enable(); }, disable: function () { return logger.disable(); } });
    }
    // @ts-ignore
    var debugGlobal = (_a = window['_debug']) !== null && _a !== void 0 ? _a : {};
    debugGlobal[key] = completeDebugger;
    // @ts-ignore
    window['_debug'] = debugGlobal;
}
//# sourceMappingURL=debug.js.map