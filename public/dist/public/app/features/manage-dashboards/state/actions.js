import { __assign, __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import { AppEvents, locationUtil } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { clearDashboard, InputType, LibraryPanelInputState, setGcomDashboard, setInputs, setJsonDashboard, setLibraryPanelInputs, } from './reducers';
import { appEvents } from '../../../core/core';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { getLibraryPanel } from '../../library-panels/state/api';
import { LibraryElementKind } from '../../library-panels/types';
export function fetchGcomDashboard(id) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        var dashboard, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getBackendSrv().get("/api/gnet/dashboards/" + id)];
                case 1:
                    dashboard = _a.sent();
                    dispatch(setGcomDashboard(dashboard));
                    dispatch(processInputs(dashboard.json));
                    dispatch(processElements(dashboard.json));
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    appEvents.emit(AppEvents.alertError, [error_1.data.message || error_1]);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
export function importDashboardJson(dashboard) {
    var _this = this;
    return function (dispatch) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            dispatch(setJsonDashboard(dashboard));
            dispatch(processInputs(dashboard));
            dispatch(processElements(dashboard));
            return [2 /*return*/];
        });
    }); };
}
function processInputs(dashboardJson) {
    return function (dispatch) {
        if (dashboardJson && dashboardJson.__inputs) {
            var inputs_1 = [];
            dashboardJson.__inputs.forEach(function (input) {
                var inputModel = {
                    name: input.name,
                    label: input.label,
                    info: input.description,
                    value: input.value,
                    type: input.type,
                    pluginId: input.pluginId,
                    options: [],
                };
                if (input.type === InputType.DataSource) {
                    getDataSourceOptions(input, inputModel);
                }
                else if (!inputModel.info) {
                    inputModel.info = 'Specify a string constant';
                }
                inputs_1.push(inputModel);
            });
            dispatch(setInputs(inputs_1));
        }
    };
}
function processElements(dashboardJson) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            var libraryPanelInputs, _a, _b, element, model, type, description, uid, name_1, input, panelInDb, e_1, e_2_1;
            var e_2, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!dashboardJson || !dashboardJson.__elements) {
                            return [2 /*return*/];
                        }
                        libraryPanelInputs = [];
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 9, 10, 11]);
                        _a = __values(dashboardJson.__elements), _b = _a.next();
                        _d.label = 2;
                    case 2:
                        if (!!_b.done) return [3 /*break*/, 8];
                        element = _b.value;
                        if (element.kind !== LibraryElementKind.Panel) {
                            return [3 /*break*/, 7];
                        }
                        model = element.model;
                        type = model.type, description = model.description;
                        uid = element.uid, name_1 = element.name;
                        input = {
                            model: {
                                model: model,
                                uid: uid,
                                name: name_1,
                                version: 0,
                                meta: {},
                                id: 0,
                                type: type,
                                kind: LibraryElementKind.Panel,
                                description: description,
                            },
                            state: LibraryPanelInputState.New,
                        };
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, getLibraryPanel(uid, true)];
                    case 4:
                        panelInDb = _d.sent();
                        input.state = LibraryPanelInputState.Exits;
                        input.model = panelInDb;
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _d.sent();
                        if (e_1.status !== 404) {
                            throw e_1;
                        }
                        return [3 /*break*/, 6];
                    case 6:
                        libraryPanelInputs.push(input);
                        _d.label = 7;
                    case 7:
                        _b = _a.next();
                        return [3 /*break*/, 2];
                    case 8: return [3 /*break*/, 11];
                    case 9:
                        e_2_1 = _d.sent();
                        e_2 = { error: e_2_1 };
                        return [3 /*break*/, 11];
                    case 10:
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_2) throw e_2.error; }
                        return [7 /*endfinally*/];
                    case 11:
                        dispatch(setLibraryPanelInputs(libraryPanelInputs));
                        return [2 /*return*/];
                }
            });
        });
    };
}
export function clearLoadedDashboard() {
    return function (dispatch) {
        dispatch(clearDashboard());
    };
}
export function importDashboard(importDashboardForm) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var dashboard, inputs, inputsToPersist, result, dashboardUrl;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    dashboard = getState().importDashboard.dashboard;
                    inputs = getState().importDashboard.inputs;
                    inputsToPersist = [];
                    (_a = importDashboardForm.dataSources) === null || _a === void 0 ? void 0 : _a.forEach(function (dataSource, index) {
                        var input = inputs.dataSources[index];
                        inputsToPersist.push({
                            name: input.name,
                            type: input.type,
                            pluginId: input.pluginId,
                            value: dataSource.name,
                        });
                    });
                    (_b = importDashboardForm.constants) === null || _b === void 0 ? void 0 : _b.forEach(function (constant, index) {
                        var input = inputs.constants[index];
                        inputsToPersist.push({
                            value: constant,
                            name: input.name,
                            type: input.type,
                        });
                    });
                    return [4 /*yield*/, getBackendSrv().post('api/dashboards/import', {
                            // uid: if user changed it, take the new uid from importDashboardForm,
                            // else read it from original dashboard
                            // by default the uid input is disabled, onSubmit ignores values from disabled inputs
                            dashboard: __assign(__assign({}, dashboard), { title: importDashboardForm.title, uid: importDashboardForm.uid || dashboard.uid }),
                            overwrite: true,
                            inputs: inputsToPersist,
                            folderId: importDashboardForm.folder.id,
                        })];
                case 1:
                    result = _c.sent();
                    dashboardUrl = locationUtil.stripBaseFromUrl(result.importedUrl);
                    locationService.push(dashboardUrl);
                    return [2 /*return*/];
            }
        });
    }); };
}
var getDataSourceOptions = function (input, inputModel) {
    var sources = getDataSourceSrv().getList({ pluginId: input.pluginId });
    if (sources.length === 0) {
        inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
    }
    else if (!inputModel.info) {
        inputModel.info = 'Select a ' + input.pluginName + ' data source';
    }
};
export function moveDashboards(dashboardUids, toFolder) {
    var e_3, _a;
    var tasks = [];
    try {
        for (var dashboardUids_1 = __values(dashboardUids), dashboardUids_1_1 = dashboardUids_1.next(); !dashboardUids_1_1.done; dashboardUids_1_1 = dashboardUids_1.next()) {
            var uid = dashboardUids_1_1.value;
            tasks.push(createTask(moveDashboard, true, uid, toFolder));
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (dashboardUids_1_1 && !dashboardUids_1_1.done && (_a = dashboardUids_1.return)) _a.call(dashboardUids_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return executeInOrder(tasks).then(function (result) {
        return {
            totalCount: result.length,
            successCount: result.filter(function (res) { return res.succeeded; }).length,
            alreadyInFolderCount: result.filter(function (res) { return res.alreadyInFolder; }).length,
        };
    });
}
function moveDashboard(uid, toFolder) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var fullDash, options, err_1, e_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getBackendSrv().getDashboardByUid(uid)];
                case 1:
                    fullDash = _b.sent();
                    if ((!fullDash.meta.folderId && toFolder.id === 0) || fullDash.meta.folderId === toFolder.id) {
                        return [2 /*return*/, { alreadyInFolder: true }];
                    }
                    options = {
                        dashboard: fullDash.dashboard,
                        folderId: toFolder.id,
                        overwrite: false,
                    };
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 9]);
                    return [4 /*yield*/, saveDashboard(options)];
                case 3:
                    _b.sent();
                    return [2 /*return*/, { succeeded: true }];
                case 4:
                    err_1 = _b.sent();
                    if (((_a = err_1.data) === null || _a === void 0 ? void 0 : _a.status) !== 'plugin-dashboard') {
                        return [2 /*return*/, { succeeded: false }];
                    }
                    err_1.isHandled = true;
                    options.overwrite = true;
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, saveDashboard(options)];
                case 6:
                    _b.sent();
                    return [2 /*return*/, { succeeded: true }];
                case 7:
                    e_4 = _b.sent();
                    return [2 /*return*/, { succeeded: false }];
                case 8: return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function createTask(fn, ignoreRejections) {
    var _this = this;
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    return function (result) { return __awaiter(_this, void 0, void 0, function () {
        var res, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fn.apply(void 0, __spreadArray([], __read(args), false))];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, Array.prototype.concat(result, [res])];
                case 2:
                    err_2 = _a.sent();
                    if (ignoreRejections) {
                        return [2 /*return*/, result];
                    }
                    throw err_2;
                case 3: return [2 /*return*/];
            }
        });
    }); };
}
export function deleteFoldersAndDashboards(folderUids, dashboardUids) {
    var e_5, _a, e_6, _b;
    var tasks = [];
    try {
        for (var folderUids_1 = __values(folderUids), folderUids_1_1 = folderUids_1.next(); !folderUids_1_1.done; folderUids_1_1 = folderUids_1.next()) {
            var folderUid = folderUids_1_1.value;
            tasks.push(createTask(deleteFolder, true, folderUid, true));
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (folderUids_1_1 && !folderUids_1_1.done && (_a = folderUids_1.return)) _a.call(folderUids_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    try {
        for (var dashboardUids_2 = __values(dashboardUids), dashboardUids_2_1 = dashboardUids_2.next(); !dashboardUids_2_1.done; dashboardUids_2_1 = dashboardUids_2.next()) {
            var dashboardUid = dashboardUids_2_1.value;
            tasks.push(createTask(deleteDashboard, true, dashboardUid, true));
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (dashboardUids_2_1 && !dashboardUids_2_1.done && (_b = dashboardUids_2.return)) _b.call(dashboardUids_2);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return executeInOrder(tasks);
}
export function saveDashboard(options) {
    var _a, _b;
    dashboardWatcher.ignoreNextSave();
    return getBackendSrv().post('/api/dashboards/db/', {
        dashboard: options.dashboard,
        message: (_a = options.message) !== null && _a !== void 0 ? _a : '',
        overwrite: (_b = options.overwrite) !== null && _b !== void 0 ? _b : false,
        folderId: options.folderId,
    });
}
function deleteFolder(uid, showSuccessAlert) {
    return getBackendSrv().request({
        method: 'DELETE',
        url: "/api/folders/" + uid + "?forceDeleteRules=true",
        showSuccessAlert: showSuccessAlert === true,
    });
}
export function createFolder(payload) {
    return getBackendSrv().post('/api/folders', payload);
}
export function searchFolders(query, permission) {
    return getBackendSrv().search({ query: query, type: 'dash-folder', permission: permission });
}
export function getFolderById(id) {
    return getBackendSrv().get("/api/folders/id/" + id);
}
export function deleteDashboard(uid, showSuccessAlert) {
    return getBackendSrv().request({
        method: 'DELETE',
        url: "/api/dashboards/uid/" + uid,
        showSuccessAlert: showSuccessAlert === true,
    });
}
function executeInOrder(tasks) {
    return tasks.reduce(function (acc, task) {
        return Promise.resolve(acc).then(task);
    }, []);
}
//# sourceMappingURL=actions.js.map