import { __awaiter } from "tslib";
import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useSelector } from 'app/types';
import { dashboardWatcher } from '../../../live/dashboard/dashboardWatcher';
import { historySrv } from './HistorySrv';
const restoreDashboard = (version, dashboard) => __awaiter(void 0, void 0, void 0, function* () {
    // Skip the watcher logic for this save since it's handled by the hook
    dashboardWatcher.ignoreNextSave();
    return yield historySrv.restoreDashboard(dashboard, version);
});
export const useDashboardRestore = (version) => {
    const dashboard = useSelector((state) => state.dashboard.getModel());
    const [state, onRestoreDashboard] = useAsyncFn(() => __awaiter(void 0, void 0, void 0, function* () { return yield restoreDashboard(version, dashboard); }), []);
    const notifyApp = useAppNotification();
    useEffect(() => {
        var _a;
        if (state.value) {
            const location = locationService.getLocation();
            const newUrl = locationUtil.stripBaseFromUrl(state.value.url);
            const prevState = (_a = location.state) === null || _a === void 0 ? void 0 : _a.routeReloadCounter;
            locationService.replace(Object.assign(Object.assign({}, location), { pathname: newUrl, state: { routeReloadCounter: prevState ? prevState + 1 : 1 } }));
            notifyApp.success('Dashboard restored', `Restored from version ${version}`);
        }
    }, [state, version, notifyApp]);
    return { state, onRestoreDashboard };
};
//# sourceMappingURL=useDashboardRestore.js.map