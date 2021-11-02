import { __awaiter, __generator, __values } from "tslib";
import { AppEvents, locationUtil } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { updateNavIndex } from 'app/core/actions';
import { buildNavModel } from './navModel';
import appEvents from 'app/core/app_events';
import { loadFolder, loadFolderPermissions } from './reducers';
export function getFolderByUid(uid) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var folder;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendSrv.getFolderByUid(uid)];
                case 1:
                    folder = _a.sent();
                    dispatch(loadFolder(folder));
                    dispatch(updateNavIndex(buildNavModel(folder)));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function saveFolder(folder) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendSrv.put("/api/folders/" + folder.uid, {
                        title: folder.title,
                        version: folder.version,
                    })];
                case 1:
                    res = _a.sent();
                    // this should be redux action at some point
                    appEvents.emit(AppEvents.alertSuccess, ['Folder saved']);
                    locationService.push(res.url + "/settings");
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteFolder(uid) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendSrv.delete("/api/folders/" + uid + "?forceDeleteRules=true")];
                case 1:
                    _a.sent();
                    locationService.push('/dashboards');
                    return [2 /*return*/];
            }
        });
    }); };
}
export function getFolderPermissions(uid) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var permissions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendSrv.get("/api/folders/" + uid + "/permissions")];
                case 1:
                    permissions = _a.sent();
                    dispatch(loadFolderPermissions(permissions));
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
export function updateFolderPermission(itemToUpdate, level) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var folder, itemsToUpdate, _a, _b, item, updated;
        var e_1, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    folder = getStore().folder;
                    itemsToUpdate = [];
                    try {
                        for (_a = __values(folder.permissions), _b = _a.next(); !_b.done; _b = _a.next()) {
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
                    return [4 /*yield*/, backendSrv.post("/api/folders/" + folder.uid + "/permissions", { items: itemsToUpdate })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, dispatch(getFolderPermissions(folder.uid))];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function removeFolderPermission(itemToDelete) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var folder, itemsToUpdate, _a, _b, item;
        var e_2, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    folder = getStore().folder;
                    itemsToUpdate = [];
                    try {
                        for (_a = __values(folder.permissions), _b = _a.next(); !_b.done; _b = _a.next()) {
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
                    return [4 /*yield*/, backendSrv.post("/api/folders/" + folder.uid + "/permissions", { items: itemsToUpdate })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, dispatch(getFolderPermissions(folder.uid))];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function addFolderPermission(newItem) {
    var _this = this;
    return function (dispatch, getStore) { return __awaiter(_this, void 0, void 0, function () {
        var folder, itemsToUpdate, _a, _b, item;
        var e_3, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    folder = getStore().folder;
                    itemsToUpdate = [];
                    try {
                        for (_a = __values(folder.permissions), _b = _a.next(); !_b.done; _b = _a.next()) {
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
                    return [4 /*yield*/, backendSrv.post("/api/folders/" + folder.uid + "/permissions", { items: itemsToUpdate })];
                case 1:
                    _d.sent();
                    return [4 /*yield*/, dispatch(getFolderPermissions(folder.uid))];
                case 2:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
export function createNewFolder(folderName) {
    var _this = this;
    return function () { return __awaiter(_this, void 0, void 0, function () {
        var newFolder;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post('/api/folders', { title: folderName })];
                case 1:
                    newFolder = _a.sent();
                    appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
                    locationService.push(locationUtil.stripBaseFromUrl(newFolder.url));
                    return [2 /*return*/];
            }
        });
    }); };
}
//# sourceMappingURL=actions.js.map