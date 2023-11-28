import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { removeAllPanels } from 'app/features/panel/state/reducers';
import { updateTimeZoneForSession, updateWeekStartForSession } from 'app/features/profile/state/reducers';
import { loadPluginDashboards } from '../../plugins/admin/state/actions';
import { cancelVariables } from '../../variables/state/actions';
import { getDashboardSrv } from '../services/DashboardSrv';
import { getTimeSrv } from '../services/TimeSrv';
import { cleanUpDashboard, loadDashboardPermissions } from './reducers';
export function getDashboardPermissions(id) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        const permissions = yield getBackendSrv().get(`/api/dashboards/id/${id}/permissions`);
        dispatch(loadDashboardPermissions(permissions));
    });
}
function toUpdateItem(item) {
    return {
        userId: item.userId,
        teamId: item.teamId,
        role: item.role,
        permission: item.permission,
    };
}
export function updateDashboardPermission(dashboardId, itemToUpdate, level) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const { dashboard } = getStore();
        const itemsToUpdate = [];
        for (const item of dashboard.permissions) {
            if (item.inherited) {
                continue;
            }
            const updated = toUpdateItem(item);
            // if this is the item we want to update, update its permission
            if (itemToUpdate === item) {
                updated.permission = level;
            }
            itemsToUpdate.push(updated);
        }
        yield getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
        yield dispatch(getDashboardPermissions(dashboardId));
    });
}
export function removeDashboardPermission(dashboardId, itemToDelete) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const dashboard = getStore().dashboard;
        const itemsToUpdate = [];
        for (const item of dashboard.permissions) {
            if (item.inherited || item === itemToDelete) {
                continue;
            }
            itemsToUpdate.push(toUpdateItem(item));
        }
        yield getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
        yield dispatch(getDashboardPermissions(dashboardId));
    });
}
export function addDashboardPermission(dashboardId, newItem) {
    return (dispatch, getStore) => __awaiter(this, void 0, void 0, function* () {
        const { dashboard } = getStore();
        const itemsToUpdate = [];
        for (const item of dashboard.permissions) {
            if (item.inherited) {
                continue;
            }
            itemsToUpdate.push(toUpdateItem(item));
        }
        itemsToUpdate.push({
            userId: newItem.userId,
            teamId: newItem.teamId,
            role: newItem.role,
            permission: newItem.permission,
        });
        yield getBackendSrv().post(`/api/dashboards/id/${dashboardId}/permissions`, { items: itemsToUpdate });
        yield dispatch(getDashboardPermissions(dashboardId));
    });
}
export function importDashboard(data, dashboardTitle) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().post('/api/dashboards/import', data);
        dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboardTitle)));
        dispatch(loadPluginDashboards());
    });
}
export function removeDashboard(uid) {
    return (dispatch) => __awaiter(this, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/dashboards/uid/${uid}`);
        dispatch(loadPluginDashboards());
    });
}
export const cleanUpDashboardAndVariables = () => (dispatch, getStore) => {
    const store = getStore();
    const dashboard = store.dashboard.getModel();
    if (dashboard) {
        dashboard.destroy();
        dispatch(cancelVariables(dashboard.uid));
    }
    getTimeSrv().stopAutoRefresh();
    dispatch(cleanUpDashboard());
    dispatch(removeAllPanels());
    dashboardWatcher.leave();
    getDashboardSrv().setCurrent(undefined);
};
export const updateTimeZoneDashboard = (timeZone) => (dispatch) => {
    dispatch(updateTimeZoneForSession(timeZone));
    getTimeSrv().refreshTimeModel();
};
export const updateWeekStartDashboard = (weekStart) => (dispatch) => {
    dispatch(updateWeekStartForSession(weekStart));
    getTimeSrv().refreshTimeModel();
};
//# sourceMappingURL=actions.js.map