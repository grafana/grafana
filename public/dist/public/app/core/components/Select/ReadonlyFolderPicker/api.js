import { __awaiter } from "tslib";
import { getFolderById, searchFolders } from '../../../../features/manage-dashboards/state/actions';
import { PermissionLevelString } from '../../../../types';
function getFolders({ query, permissionLevel }) {
    return __awaiter(this, void 0, void 0, function* () {
        const searchHits = yield searchFolders(query, permissionLevel);
        const folders = searchHits.map((searchHit) => ({
            id: searchHit.id,
            title: searchHit.title,
            url: searchHit.url,
        }));
        return folders;
    });
}
function getFoldersWithEntries({ query, permissionLevel, extraFolders, }) {
    return __awaiter(this, void 0, void 0, function* () {
        const folders = yield getFolders({ query, permissionLevel });
        const extra = extraFolders !== null && extraFolders !== void 0 ? extraFolders : [];
        const filteredExtra = query ? extra.filter((f) => { var _a; return (_a = f.title) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query.toLowerCase()); }) : extra;
        if (folders) {
            return filteredExtra.concat(folders);
        }
        return filteredExtra;
    });
}
export function getFoldersAsOptions({ query, permissionLevel = PermissionLevelString.View, extraFolders = [], }) {
    return __awaiter(this, void 0, void 0, function* () {
        const folders = yield getFoldersWithEntries({ query, permissionLevel, extraFolders });
        return folders.map((value) => {
            const option = { value, label: value.title };
            return option;
        });
    });
}
export function findOptionWithId(options, id) {
    return options === null || options === void 0 ? void 0 : options.find((o) => { var _a; return ((_a = o.value) === null || _a === void 0 ? void 0 : _a.id) === id; });
}
export function getFolderAsOption(folderId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (folderId === undefined || folderId === null) {
            return;
        }
        try {
            const { id, title } = yield getFolderById(folderId);
            return { value: { id, title }, label: title };
        }
        catch (err) {
            console.error(`Could not find folder with id:${folderId}`);
        }
        return;
    });
}
//# sourceMappingURL=api.js.map