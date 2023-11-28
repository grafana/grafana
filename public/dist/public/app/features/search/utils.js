import { SECTION_STORAGE_KEY } from './constants';
/**
 * Check if search query has filters enabled. Excludes folderId
 * @param query
 */
export const hasFilters = (query) => {
    var _a;
    if (!query) {
        return false;
    }
    return Boolean(query.query || ((_a = query.tag) === null || _a === void 0 ? void 0 : _a.length) > 0 || query.starred || query.sort);
};
/** Cleans up old local storage values that remembered many open folders */
export const cleanupOldExpandedFolders = () => {
    const keyPrefix = SECTION_STORAGE_KEY + '.';
    for (let index = 0; index < window.localStorage.length; index++) {
        const lsKey = window.localStorage.key(index);
        if (lsKey === null || lsKey === void 0 ? void 0 : lsKey.startsWith(keyPrefix)) {
            window.localStorage.removeItem(lsKey);
        }
    }
};
/**
 * Get storage key for a dashboard folder by its title
 * @param title
 */
export const getSectionStorageKey = (title = 'General') => {
    return `${SECTION_STORAGE_KEY}.${title.toLowerCase()}`;
};
/**
 * Remove undefined keys from url params object and format non-primitive values
 * @param params
 * @param folder
 */
export const parseRouteParams = (params) => {
    var _a;
    const cleanedParams = Object.entries(params).reduce((obj, [key, val]) => {
        if (!val) {
            return obj;
        }
        else if (key === 'tag' && !Array.isArray(val)) {
            return Object.assign(Object.assign({}, obj), { tag: [val] });
        }
        return Object.assign(Object.assign({}, obj), { [key]: val });
    }, {});
    if (params.folder) {
        const folderStr = `folder:${params.folder}`;
        return Object.assign(Object.assign({}, cleanedParams), { query: `${folderStr} ${((_a = cleanedParams.query) !== null && _a !== void 0 ? _a : '').replace(folderStr, '')}` });
    }
    return Object.assign({}, cleanedParams);
};
//# sourceMappingURL=utils.js.map