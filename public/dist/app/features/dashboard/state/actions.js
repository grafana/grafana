import * as tslib_1 from "tslib";
// Services & Utils
import { getBackendSrv } from 'app/core/services/backend_srv';
import { actionCreatorFactory, noPayloadActionCreatorFactory } from 'app/core/redux';
import { createSuccessNotification } from 'app/core/copy/appNotification';
// Actions
import { loadPluginDashboards } from '../../plugins/state/actions';
import { notifyApp } from 'app/core/actions';
export var loadDashboardPermissions = actionCreatorFactory('LOAD_DASHBOARD_PERMISSIONS').create();
export var dashboardInitFetching = noPayloadActionCreatorFactory('DASHBOARD_INIT_FETCHING').create();
export var dashboardInitServices = noPayloadActionCreatorFactory('DASHBOARD_INIT_SERVICES').create();
export var dashboardInitSlow = noPayloadActionCreatorFactory('SET_DASHBOARD_INIT_SLOW').create();
export var dashboardInitCompleted = actionCreatorFactory('DASHBOARD_INIT_COMLETED').create();
/*
 * Unrecoverable init failure (fetch or model creation failed)
 */
export var dashboardInitFailed = actionCreatorFactory('DASHBOARD_INIT_FAILED').create();
/*
 * When leaving dashboard, resets state
 * */
export var cleanUpDashboard = noPayloadActionCreatorFactory('DASHBOARD_CLEAN_UP').create();
export function getDashboardPermissions(id) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var permissions;
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var e_1, _a, dashboard, itemsToUpdate, _b, _c, item, updated;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dashboard = getStore().dashboard;
                    itemsToUpdate = [];
                    try {
                        for (_b = tslib_1.__values(dashboard.permissions), _c = _b.next(); !_c.done; _c = _b.next()) {
                            item = _c.value;
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
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var e_2, _a, dashboard, itemsToUpdate, _b, _c, item;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dashboard = getStore().dashboard;
                    itemsToUpdate = [];
                    try {
                        for (_b = tslib_1.__values(dashboard.permissions), _c = _b.next(); !_c.done; _c = _b.next()) {
                            item = _c.value;
                            if (item.inherited || item === itemToDelete) {
                                continue;
                            }
                            itemsToUpdate.push(toUpdateItem(item));
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var e_3, _a, dashboard, itemsToUpdate, _b, _c, item;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dashboard = getStore().dashboard;
                    itemsToUpdate = [];
                    try {
                        for (_b = tslib_1.__values(dashboard.permissions), _c = _b.next(); !_c.done; _c = _b.next()) {
                            item = _c.value;
                            if (item.inherited) {
                                continue;
                            }
                            itemsToUpdate.push(toUpdateItem(item));
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
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
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
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
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
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
//# sourceMappingURL=actions.js.map