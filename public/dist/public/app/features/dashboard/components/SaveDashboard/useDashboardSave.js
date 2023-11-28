import { __awaiter } from "tslib";
import { useAsyncFn } from 'react-use';
import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { useSaveDashboardMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { useDispatch } from 'app/types';
import { DashboardSavedEvent } from 'app/types/events';
import { updateDashboardUidLastUsedDatasource } from '../../utils/dashboard';
const saveDashboard = (saveModel, options, dashboard, saveDashboardRtkQuery) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    if (newBrowseDashboardsEnabled()) {
        const query = yield saveDashboardRtkQuery({
            dashboard: saveModel,
            folderUid: (_b = (_a = options.folderUid) !== null && _a !== void 0 ? _a : dashboard.meta.folderUid) !== null && _b !== void 0 ? _b : saveModel.meta.folderUid,
            message: options.message,
            overwrite: options.overwrite,
        });
        if ('error' in query) {
            throw query.error;
        }
        return query.data;
    }
    else {
        let folderUid = options.folderUid;
        if (folderUid === undefined) {
            folderUid = (_c = dashboard.meta.folderUid) !== null && _c !== void 0 ? _c : saveModel.folderUid;
        }
        const result = yield saveDashboardApiCall(Object.assign(Object.assign({}, options), { folderUid, dashboard: saveModel }));
        // fetch updated access control permissions
        yield contextSrv.fetchUserPermissions();
        return result;
    }
});
export const useDashboardSave = (isCopy = false) => {
    const dispatch = useDispatch();
    const notifyApp = useAppNotification();
    const [saveDashboardRtkQuery] = useSaveDashboardMutation();
    const [state, onDashboardSave] = useAsyncFn((clone, options, dashboard) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const result = yield saveDashboard(clone, options, dashboard, saveDashboardRtkQuery);
            dashboard.version = result.version;
            clone.version = result.version;
            dashboard.clearUnsavedChanges(clone, options);
            // important that these happen before location redirect below
            appEvents.publish(new DashboardSavedEvent());
            notifyApp.success('Dashboard saved');
            //Update local storage dashboard to handle things like last used datasource
            updateDashboardUidLastUsedDatasource(result.uid);
            if (isCopy) {
                reportInteraction('grafana_dashboard_copied', {
                    name: dashboard.title,
                    url: result.url,
                });
            }
            else {
                reportInteraction(`grafana_dashboard_${dashboard.id ? 'saved' : 'created'}`, {
                    name: dashboard.title,
                    url: result.url,
                });
            }
            const currentPath = locationService.getLocation().pathname;
            const newUrl = locationUtil.stripBaseFromUrl(result.url);
            if (newUrl !== currentPath) {
                setTimeout(() => locationService.replace(newUrl));
            }
            if (dashboard.meta.isStarred) {
                dispatch(updateDashboardName({
                    id: dashboard.uid,
                    title: dashboard.title,
                    url: newUrl,
                }));
            }
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                notifyApp.error((_a = error.message) !== null && _a !== void 0 ? _a : 'Error saving dashboard');
            }
            throw error;
        }
    }), [dispatch, notifyApp]);
    return { state, onDashboardSave };
};
//# sourceMappingURL=useDashboardSave.js.map