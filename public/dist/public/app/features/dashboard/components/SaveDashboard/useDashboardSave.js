import { __assign, __awaiter, __generator, __read } from "tslib";
import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { AppEvents, locationUtil } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { locationService } from '@grafana/runtime';
import { DashboardSavedEvent } from 'app/types/events';
var saveDashboard = function (saveModel, options, dashboard) {
    var _a;
    var folderId = options.folderId;
    if (folderId === undefined) {
        folderId = (_a = dashboard.meta.folderId) !== null && _a !== void 0 ? _a : saveModel.folderId;
    }
    return saveDashboardApiCall(__assign(__assign({}, options), { folderId: folderId, dashboard: saveModel }));
};
export var useDashboardSave = function (dashboard) {
    var _a = __read(useAsyncFn(function (clone, options, dashboard) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, saveDashboard(clone, options, dashboard)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, []), 2), state = _a[0], onDashboardSave = _a[1];
    useEffect(function () {
        if (state.value) {
            dashboard.version = state.value.version;
            dashboard.clearUnsavedChanges();
            // important that these happen before location redirect below
            appEvents.publish(new DashboardSavedEvent());
            appEvents.emit(AppEvents.alertSuccess, ['Dashboard saved']);
            var currentPath = locationService.getLocation().pathname;
            var newUrl_1 = locationUtil.stripBaseFromUrl(state.value.url);
            if (newUrl_1 !== currentPath) {
                setTimeout(function () { return locationService.replace(newUrl_1); });
            }
        }
    }, [dashboard, state]);
    return { state: state, onDashboardSave: onDashboardSave };
};
//# sourceMappingURL=useDashboardSave.js.map