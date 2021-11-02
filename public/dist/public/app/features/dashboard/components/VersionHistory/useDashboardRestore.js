import { __assign, __awaiter, __generator, __read } from "tslib";
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useAsyncFn } from 'react-use';
import { AppEvents, locationUtil } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { historySrv } from './HistorySrv';
import { locationService } from '@grafana/runtime';
var restoreDashboard = function (version, dashboard) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, historySrv.restoreDashboard(dashboard, version)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
export var useDashboardRestore = function (version) {
    var dashboard = useSelector(function (state) { return state.dashboard.getModel(); });
    var _a = __read(useAsyncFn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, restoreDashboard(version, dashboard)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, []), 2), state = _a[0], onRestoreDashboard = _a[1];
    useEffect(function () {
        var _a;
        if (state.value) {
            var location_1 = locationService.getLocation();
            var newUrl = locationUtil.stripBaseFromUrl(state.value.url);
            var prevState = (_a = location_1.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter;
            locationService.replace(__assign(__assign({}, location_1), { pathname: newUrl, state: { routeReloadCounter: prevState ? prevState + 1 : 1 } }));
            appEvents.emit(AppEvents.alertSuccess, ['Dashboard restored', 'Restored from version ' + version]);
        }
    }, [state, version]);
    return { state: state, onRestoreDashboard: onRestoreDashboard };
};
//# sourceMappingURL=useDashboardRestore.js.map