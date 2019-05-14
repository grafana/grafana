import * as tslib_1 from "tslib";
var handlers = [];
export function applyRouteRegistrationHandlers($routeProvider) {
    var e_1, _a;
    try {
        for (var handlers_1 = tslib_1.__values(handlers), handlers_1_1 = handlers_1.next(); !handlers_1_1.done; handlers_1_1 = handlers_1.next()) {
            var handler = handlers_1_1.value;
            handler($routeProvider);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (handlers_1_1 && !handlers_1_1.done && (_a = handlers_1.return)) _a.call(handlers_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
export function addRouteRegistrationHandler(fn) {
    handlers.push(fn);
}
//# sourceMappingURL=registry.js.map