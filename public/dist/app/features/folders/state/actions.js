import * as tslib_1 from "tslib";
import { getBackendSrv } from 'app/core/services/backend_srv';
import { updateNavIndex, updateLocation } from 'app/core/actions';
import { buildNavModel } from './navModel';
import appEvents from 'app/core/app_events';
export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["LoadFolder"] = "LOAD_FOLDER";
    ActionTypes["SetFolderTitle"] = "SET_FOLDER_TITLE";
    ActionTypes["SaveFolder"] = "SAVE_FOLDER";
    ActionTypes["LoadFolderPermissions"] = "LOAD_FOLDER_PERMISSONS";
})(ActionTypes || (ActionTypes = {}));
export var loadFolder = function (folder) { return ({
    type: ActionTypes.LoadFolder,
    payload: folder,
}); };
export var setFolderTitle = function (newTitle) { return ({
    type: ActionTypes.SetFolderTitle,
    payload: newTitle,
}); };
export var loadFolderPermissions = function (items) { return ({
    type: ActionTypes.LoadFolderPermissions,
    payload: items,
}); };
export function getFolderByUid(uid) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var folder;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().getFolderByUid(uid)];
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
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var res;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().put("/api/folders/" + folder.uid, {
                        title: folder.title,
                        version: folder.version,
                    })];
                case 1:
                    res = _a.sent();
                    // this should be redux action at some point
                    appEvents.emit('alert-success', ['Folder saved']);
                    dispatch(updateLocation({ path: res.url + "/settings" }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function deleteFolder(uid) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().deleteFolder(uid, true)];
                case 1:
                    _a.sent();
                    dispatch(updateLocation({ path: "dashboards" }));
                    return [2 /*return*/];
            }
        });
    }); };
}
export function getFolderPermissions(uid) {
    var _this = this;
    return function (dispatch) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var permissions;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/folders/" + uid + "/permissions")];
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var e_1, _a, folder, itemsToUpdate, _b, _c, item, updated;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    folder = getStore().folder;
                    itemsToUpdate = [];
                    try {
                        for (_b = tslib_1.__values(folder.permissions), _c = _b.next(); !_c.done; _c = _b.next()) {
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
                    return [4 /*yield*/, getBackendSrv().post("/api/folders/" + folder.uid + "/permissions", { items: itemsToUpdate })];
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var e_2, _a, folder, itemsToUpdate, _b, _c, item;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    folder = getStore().folder;
                    itemsToUpdate = [];
                    try {
                        for (_b = tslib_1.__values(folder.permissions), _c = _b.next(); !_c.done; _c = _b.next()) {
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
                    return [4 /*yield*/, getBackendSrv().post("/api/folders/" + folder.uid + "/permissions", { items: itemsToUpdate })];
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
    return function (dispatch, getStore) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var e_3, _a, folder, itemsToUpdate, _b, _c, item;
        return tslib_1.__generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    folder = getStore().folder;
                    itemsToUpdate = [];
                    try {
                        for (_b = tslib_1.__values(folder.permissions), _c = _b.next(); !_c.done; _c = _b.next()) {
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
                    return [4 /*yield*/, getBackendSrv().post("/api/folders/" + folder.uid + "/permissions", { items: itemsToUpdate })];
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
//# sourceMappingURL=actions.js.map