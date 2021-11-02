import { __awaiter, __generator } from "tslib";
import { LibraryElementKind, } from '../types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { lastValueFrom } from 'rxjs';
export function getLibraryPanels(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.searchString, searchString = _c === void 0 ? '' : _c, _d = _b.perPage, perPage = _d === void 0 ? 100 : _d, _e = _b.page, page = _e === void 0 ? 1 : _e, _f = _b.excludeUid, excludeUid = _f === void 0 ? '' : _f, _g = _b.sortDirection, sortDirection = _g === void 0 ? '' : _g, _h = _b.typeFilter, typeFilter = _h === void 0 ? [] : _h, _j = _b.folderFilter, folderFilter = _j === void 0 ? [] : _j;
    return __awaiter(this, void 0, void 0, function () {
        var params, result;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    params = new URLSearchParams();
                    params.append('searchString', searchString);
                    params.append('sortDirection', sortDirection);
                    params.append('typeFilter', typeFilter.join(','));
                    params.append('folderFilter', folderFilter.join(','));
                    params.append('excludeUid', excludeUid);
                    params.append('perPage', perPage.toString(10));
                    params.append('page', page.toString(10));
                    params.append('kind', LibraryElementKind.Panel.toString(10));
                    return [4 /*yield*/, getBackendSrv().get("/api/library-elements?" + params.toString())];
                case 1:
                    result = (_k.sent()).result;
                    return [2 /*return*/, result];
            }
        });
    });
}
export function getLibraryPanel(uid, isHandled) {
    if (isHandled === void 0) { isHandled = false; }
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, lastValueFrom(getBackendSrv().fetch({
                        method: 'GET',
                        url: "/api/library-elements/" + uid,
                        showSuccessAlert: !isHandled,
                        showErrorAlert: !isHandled,
                    }))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data.result];
            }
        });
    });
}
export function getLibraryPanelByName(name) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/library-elements/name/" + name)];
                case 1:
                    result = (_a.sent()).result;
                    return [2 /*return*/, result];
            }
        });
    });
}
export function addLibraryPanel(panelSaveModel, folderId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().post("/api/library-elements", {
                        folderId: folderId,
                        name: panelSaveModel.libraryPanel.name,
                        model: panelSaveModel,
                        kind: LibraryElementKind.Panel,
                    })];
                case 1:
                    result = (_a.sent()).result;
                    return [2 /*return*/, result];
            }
        });
    });
}
export function updateLibraryPanel(panelSaveModel) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, uid, name, version, kind, model, result;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = panelSaveModel.libraryPanel, uid = _a.uid, name = _a.name, version = _a.version;
                    kind = LibraryElementKind.Panel;
                    model = panelSaveModel;
                    return [4 /*yield*/, getBackendSrv().patch("/api/library-elements/" + uid, {
                            name: name,
                            model: model,
                            version: version,
                            kind: kind,
                        })];
                case 1:
                    result = (_b.sent()).result;
                    return [2 /*return*/, result];
            }
        });
    });
}
export function deleteLibraryPanel(uid) {
    return getBackendSrv().delete("/api/library-elements/" + uid);
}
export function getLibraryPanelConnectedDashboards(libraryPanelUid) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/library-elements/" + libraryPanelUid + "/connections")];
                case 1:
                    result = (_a.sent()).result;
                    return [2 /*return*/, result];
            }
        });
    });
}
export function getConnectedDashboards(uid) {
    return __awaiter(this, void 0, void 0, function () {
        var connections, searchHits;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getLibraryPanelConnectedDashboards(uid)];
                case 1:
                    connections = _a.sent();
                    if (connections.length === 0) {
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, getBackendSrv().search({ dashboardIds: connections.map(function (c) { return c.connectionId; }) })];
                case 2:
                    searchHits = _a.sent();
                    return [2 /*return*/, searchHits];
            }
        });
    });
}
//# sourceMappingURL=api.js.map