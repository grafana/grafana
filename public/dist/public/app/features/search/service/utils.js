import { __awaiter } from "tslib";
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
/** prepare the query replacing folder:current */
export function replaceCurrentFolderQuery(query) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (query.query && query.query.indexOf('folder:current') >= 0) {
            query = Object.assign(Object.assign({}, query), { location: yield getCurrentFolderUID(), query: query.query.replace('folder:current', '').trim() });
            if (!((_a = query.query) === null || _a === void 0 ? void 0 : _a.length)) {
                query.query = '*';
            }
        }
        return Promise.resolve(query);
    });
}
function getCurrentFolderUID() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let dash = getDashboardSrv().getCurrent();
            if (!dash) {
                yield delay(500); // may not be loaded yet
                dash = getDashboardSrv().getCurrent();
            }
            return Promise.resolve((_a = dash === null || dash === void 0 ? void 0 : dash.meta) === null || _a === void 0 ? void 0 : _a.folderUid);
        }
        catch (e) {
            console.error(e);
        }
        return undefined;
    });
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function getIconForKind(kind, isOpen) {
    if (kind === 'dashboard') {
        return 'apps';
    }
    if (kind === 'folder') {
        return isOpen ? 'folder-open' : 'folder';
    }
    return 'question-circle';
}
function parseKindString(kind) {
    switch (kind) {
        case 'dashboard':
        case 'folder':
        case 'panel':
            return kind;
        default:
            return 'dashboard'; // not a great fallback, but it's the previous behaviour
    }
}
export function queryResultToViewItem(item, view) {
    var _a, _b;
    const meta = (_a = view === null || view === void 0 ? void 0 : view.dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom;
    const viewItem = {
        kind: parseKindString(item.kind),
        uid: item.uid,
        title: item.name,
        url: item.url,
        tags: (_b = item.tags) !== null && _b !== void 0 ? _b : [],
    };
    // Set enterprise sort value property
    const sortFieldName = meta === null || meta === void 0 ? void 0 : meta.sortBy;
    if (sortFieldName) {
        const sortFieldValue = item[sortFieldName];
        if (typeof sortFieldValue === 'string' || typeof sortFieldValue === 'number') {
            viewItem.sortMetaName = sortFieldName;
            viewItem.sortMeta = sortFieldValue;
        }
    }
    if (item.location) {
        const ancestors = item.location.split('/');
        const parentUid = ancestors[ancestors.length - 1];
        const parentInfo = meta === null || meta === void 0 ? void 0 : meta.locationInfo[parentUid];
        if (parentInfo) {
            viewItem.parentTitle = parentInfo.name;
            viewItem.parentKind = parentInfo.kind;
            viewItem.parentUID = parentUid;
        }
    }
    return viewItem;
}
//# sourceMappingURL=utils.js.map