import { __awaiter, __generator, __values } from "tslib";
// Services & Utils
import { getBackendSrv } from '@grafana/runtime';
import { createSuccessNotification } from 'app/core/copy/appNotification';
// Actions
import { loadPluginDashboards } from '../../plugins/state/actions';
import { cleanUpDashboard, loadDashboardPermissions } from './reducers';
import { notifyApp } from 'app/core/actions';
import { updateTimeZoneForSession, updateWeekStartForSession } from 'app/features/profile/state/reducers';
import { cancelVariables } from '../../variables/state/actions';
import { getTimeSrv } from '../services/TimeSrv';
export function getDashboardPermissions(id) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var permissions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/dashboards/id/" + id + "/permissions")];
                case 1:
                    permissions = _a.sent();
                    dispatch(loadDashboardPermissions(permissions));
                    return [2 /*return*/];
            }
        });
    }); };
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
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dashboard, itemsToUpdate, _a, _b, item, updated;
        var e_1, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dashboard = getStore().dashboard;
                    itemsToUpdate = [];
                    try {
                        for (_a = __values(dashboard.permissions), _b = _a.next(); !_b.done; _b = _a.next()) {
                            item = _b.value;
                            if (item.inherited) {
                                continue;
                            }
                            updated = toUpdateItem(item);
                            // if this is the item we want to update, update it's permission
                            if (itemToUpdate === item) {
                                updated.permission = level;
                            }
                            itemsToUpdate.push(updated);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    return [4 /*yield*/, getBackendSrv().post("/api/dashboards/id/" + dashboardId + "/permissions", { items: itemsToUpdate })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, dispatch(getDashboardPermissions(dashboardId))];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function removeDashboardPermission(dashboardId, itemToDelete) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dashboard, itemsToUpdate, _a, _b, item;
        var e_2, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dashboard = getStore().dashboard;
                    itemsToUpdate = [];
                    try {
                        for (_a = __values(dashboard.permissions), _b = _a.next(); !_b.done; _b = _a.next()) {
                            item = _b.value;
                            if (item.inherited || item === itemToDelete) {
                                continue;
                            }
                            itemsToUpdate.push(toUpdateItem(item));
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return [4 /*yield*/, getBackendSrv().post("/api/dashboards/id/" + dashboardId + "/permissions", { items: itemsToUpdate })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, dispatch(getDashboardPermissions(dashboardId))];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function addDashboardPermission(dashboardId, newItem) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var dashboard, itemsToUpdate, _a, _b, item;
        var e_3, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dashboard = getStore().dashboard;
                    itemsToUpdate = [];
                    try {
                        for (_a = __values(dashboard.permissions), _b = _a.next(); !_b.done; _b = _a.next()) {
                            item = _b.value;
                            if (item.inherited) {
                                continue;
                            }
                            itemsToUpdate.push(toUpdateItem(item));
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    itemsToUpdate.push({
                        userId: newItem.userId,
                        teamId: newItem.teamId,
                        role: newItem.role,
                        permission: newItem.permission,
                    });
                    return [4 /*yield*/, getBackendSrv().post("/api/dashboards/id/" + dashboardId + "/permissions", { items: itemsToUpdate })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, dispatch(getDashboardPermissions(dashboardId))];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function importDashboard(data, dashboardTitle) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/dashboards/import', data)];
                case 1:
                    _a.sent();
                    dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboardTitle)));
                    dispatch(loadPluginDashboards());
                    return [2 /*return*/];
            }
        });
    }); };
}
export function removeDashboard(uri) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/dashboards/" + uri)];
                case 1:
                    _a.sent();
                    dispatch(loadPluginDashboards());
                    return [2 /*return*/];
            }
        });
    }); };
}
export var cleanUpDashboardAndVariables = function () { return function (dispatch, getStore) {
    var store = getStore();
    var dashboard = store.dashboard.getModel();
    if (dashboard) {
        dashboard.destroy();
    }
    getTimeSrv().stopAutoRefresh();
    dispatch(cleanUpDashboard());
    dispatch(cancelVariables());
}; };
export var updateTimeZoneDashboard = function (timeZone) { return function (dispatch) {
    dispatch(updateTimeZoneForSession(timeZone));
    getTimeSrv().refreshDashboard();
}; };
export var updateWeekStartDashboard = function (weekStart) { return function (dispatch) {
    dispatch(updateWeekStartForSession(weekStart));
    getTimeSrv().refreshDashboard();
}; };
//# sourceMappingURL=actions.js.map