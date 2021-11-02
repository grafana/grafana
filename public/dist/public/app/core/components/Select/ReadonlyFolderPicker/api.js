import { __awaiter, __generator } from "tslib";
import { PermissionLevelString } from '../../../../types';
import { getFolderById, searchFolders } from '../../../../features/manage-dashboards/state/actions';
function getFolders(_a) {
    var query = _a.query, permissionLevel = _a.permissionLevel;
    return __awaiter(this, void 0, void 0, function () {
        var searchHits, folders;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, searchFolders(query, permissionLevel)];
                case 1:
                    searchHits = _b.sent();
                    folders = searchHits.map(function (searchHit) { return ({
                        id: searchHit.id,
                        title: searchHit.title,
                        url: searchHit.url,
                    }); });
                    return [2 /*return*/, folders];
            }
        });
    });
}
function getFoldersWithEntries(_a) {
    var query = _a.query, permissionLevel = _a.permissionLevel, extraFolders = _a.extraFolders;
    return __awaiter(this, void 0, void 0, function () {
        var folders, extra, filteredExtra;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getFolders({ query: query, permissionLevel: permissionLevel })];
                case 1:
                    folders = _b.sent();
                    extra = extraFolders !== null && extraFolders !== void 0 ? extraFolders : [];
                    filteredExtra = query ? extra.filter(function (f) { var _a; return (_a = f.title) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query.toLowerCase()); }) : extra;
                    if (folders) {
                        return [2 /*return*/, filteredExtra.concat(folders)];
                    }
                    return [2 /*return*/, filteredExtra];
            }
        });
    });
}
export function getFoldersAsOptions(_a) {
    var query = _a.query, _b = _a.permissionLevel, permissionLevel = _b === void 0 ? PermissionLevelString.View : _b, _c = _a.extraFolders, extraFolders = _c === void 0 ? [] : _c;
    return __awaiter(this, void 0, void 0, function () {
        var folders;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, getFoldersWithEntries({ query: query, permissionLevel: permissionLevel, extraFolders: extraFolders })];
                case 1:
                    folders = _d.sent();
                    return [2 /*return*/, folders.map(function (value) {
                            var option = { value: value, label: value.title };
                            return option;
                        })];
            }
        });
    });
}
export function findOptionWithId(options, id) {
    return options === null || options === void 0 ? void 0 : options.find(function (o) { var _a; return ((_a = o.value) === null || _a === void 0 ? void 0 : _a.id) === id; });
}
export function getFolderAsOption(folderId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, id, title, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (folderId === undefined || folderId === null) {
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, getFolderById(folderId)];
                case 2:
                    _a = _b.sent(), id = _a.id, title = _a.title;
                    return [2 /*return*/, { value: { id: id, title: title }, label: title }];
                case 3:
                    err_1 = _b.sent();
                    console.error("Could not find folder with id:" + folderId);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
//# sourceMappingURL=api.js.map