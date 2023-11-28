import { __awaiter } from "tslib";
import { getBackendSrv } from '@grafana/runtime';
function getFolderUID(folderID) {
    return __awaiter(this, void 0, void 0, function* () {
        // folderID 0 is always the fake General/Dashboards folder, which always has a UID of empty string
        if (folderID === 0) {
            return '';
        }
        const folderDTO = yield getBackendSrv().get(`/api/folders/id/${folderID}`, undefined, undefined, {
            showErrorAlert: false,
        });
        return folderDTO.uid;
    });
}
export function dashlistMigrationHandler(panel) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __awaiter(this, void 0, void 0, function* () {
        // Convert old angular model to new react model
        const newOptions = Object.assign(Object.assign({}, panel.options), { showStarred: (_a = panel.options.showStarred) !== null && _a !== void 0 ? _a : panel.starred, showRecentlyViewed: (_b = panel.options.showRecentlyViewed) !== null && _b !== void 0 ? _b : panel.recent, showSearch: (_c = panel.options.showSearch) !== null && _c !== void 0 ? _c : panel.search, showHeadings: (_d = panel.options.showHeadings) !== null && _d !== void 0 ? _d : panel.headings, maxItems: (_e = panel.options.maxItems) !== null && _e !== void 0 ? _e : panel.limit, query: (_f = panel.options.query) !== null && _f !== void 0 ? _f : panel.query, folderId: (_g = panel.options.folderId) !== null && _g !== void 0 ? _g : panel.folderId, tags: (_h = panel.options.tags) !== null && _h !== void 0 ? _h : panel.tags });
        // Delete old angular properties
        const previousVersion = parseFloat(panel.pluginVersion || '6.1');
        if (previousVersion < 6.3) {
            const oldProps = ['starred', 'recent', 'search', 'headings', 'limit', 'query', 'folderId'];
            oldProps.forEach((prop) => delete panel[prop]);
        }
        // Convert the folderId to folderUID. Uses the API to do the conversion.
        if (newOptions.folderId !== undefined) {
            const folderId = newOptions.folderId;
            // If converting ID to UID fails, the panel will not be migrated and will show incorrectly
            try {
                const folderUID = yield getFolderUID(folderId);
                newOptions.folderUID = folderUID;
                delete newOptions.folderId;
            }
            catch (err) {
                console.warn('Dashlist: Error migrating folder ID to UID', err);
            }
        }
        return newOptions;
    });
}
//# sourceMappingURL=migrations.js.map