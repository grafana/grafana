import { __assign, __read, __spreadArray, __values } from "tslib";
import { parse } from 'search-query-parser';
import { NO_ID_SECTIONS, SECTION_STORAGE_KEY } from './constants';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
/**
 * Check if folder has id. Only Recent and Starred folders are the ones without
 * ids so far, as they are created manually after results are fetched from API.
 * @param str
 */
export var hasId = function (str) {
    return !NO_ID_SECTIONS.includes(str);
};
/**
 * Return ids for folders concatenated with their items ids, if section is expanded.
 * For items the id format is '{folderId}-{itemId}' to allow mapping them to their folders
 * @param sections
 */
export var getFlattenedSections = function (sections) {
    return sections.flatMap(function (section) {
        var id = hasId(section.title) ? String(section.id) : section.title;
        if (section.expanded && section.items.length) {
            return __spreadArray([id], __read(section.items.map(function (item) { return id + "-" + item.id; })), false);
        }
        return id;
    });
};
/**
 * Get all items for currently expanded sections
 * @param sections
 */
export var getVisibleItems = function (sections) {
    return sections.flatMap(function (section) {
        if (section.expanded) {
            return section.items;
        }
        return [];
    });
};
/**
 * Since Recent and Starred folders don't have id, title field is used as id
 * @param title - title field of the section
 */
export var getLookupField = function (title) {
    return hasId(title) ? 'id' : 'title';
};
/**
 * Go through all the folders and items in expanded folders and toggle their selected
 * prop according to currently selected index. Used for item highlighting when navigating
 * the search results list using keyboard arrows
 * @param sections
 * @param selectedId
 */
export var markSelected = function (sections, selectedId) {
    return sections.map(function (result) {
        var lookupField = getLookupField(selectedId);
        result = __assign(__assign({}, result), { selected: String(result[lookupField]) === selectedId });
        if (result.expanded && result.items.length) {
            return __assign(__assign({}, result), { items: result.items.map(function (item) {
                    var _a = __read(selectedId.split('-'), 2), sectionId = _a[0], itemId = _a[1];
                    var lookup = getLookupField(sectionId);
                    return __assign(__assign({}, item), { selected: String(item.id) === itemId && String(result[lookup]) === sectionId });
                }) });
        }
        return result;
    });
};
/**
 * Find items with property 'selected' set true in a list of folders and their items.
 * Does recursive search in the items list.
 * @param sections
 */
export var findSelected = function (sections) {
    var e_1, _a;
    var found = null;
    try {
        for (var sections_1 = __values(sections), sections_1_1 = sections_1.next(); !sections_1_1.done; sections_1_1 = sections_1.next()) {
            var section = sections_1_1.value;
            if (section.expanded && section.items.length) {
                found = findSelected(section.items);
            }
            if (section.selected) {
                found = section;
            }
            if (found) {
                return found;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (sections_1_1 && !sections_1_1.done && (_a = sections_1.return)) _a.call(sections_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return null;
};
export var parseQuery = function (query) {
    var parsedQuery = parse(query, {
        keywords: ['folder'],
    });
    if (typeof parsedQuery === 'string') {
        return {
            text: parsedQuery,
        };
    }
    return parsedQuery;
};
/**
 * Merge multiple reducers into one, keeping the state structure flat (no nested
 * separate state for each reducer). If there are multiple state slices with the same
 * key, the latest reducer's state is applied.
 * Compared to Redux's combineReducers this allows multiple reducers to operate
 * on the same state or different slices of the same state. Useful when multiple
 * components have the same structure but different or extra logic when modifying it.
 * If reducers have the same action types, the action types from the rightmost reducer
 * take precedence
 * @param reducers
 */
export var mergeReducers = function (reducers) { return function (prevState, action) {
    return reducers.reduce(function (nextState, reducer) { return (__assign(__assign({}, nextState), reducer(nextState, action))); }, prevState);
}; };
/**
 * Collect all the checked dashboards
 * @param sections
 */
export var getCheckedDashboards = function (sections) {
    if (!sections.length) {
        return [];
    }
    return sections.reduce(function (uids, section) {
        return section.items ? __spreadArray(__spreadArray([], __read(uids), false), __read(section.items.filter(function (item) { return item.checked; })), false) : uids;
    }, []);
};
/**
 * Collect uids of all the checked dashboards
 * @param sections
 */
export var getCheckedDashboardsUids = function (sections) {
    if (!sections.length) {
        return [];
    }
    return getCheckedDashboards(sections).map(function (item) { return item.uid; });
};
/**
 * Collect uids of all checked folders and dashboards. Used for delete operation, among others
 * @param sections
 */
export var getCheckedUids = function (sections) {
    var emptyResults = { folders: [], dashboards: [] };
    if (!sections.length) {
        return emptyResults;
    }
    return sections.reduce(function (result, section) {
        if ((section === null || section === void 0 ? void 0 : section.id) !== 0 && section.checked) {
            return __assign(__assign({}, result), { folders: __spreadArray(__spreadArray([], __read(result.folders), false), [section.uid], false) });
        }
        else {
            return __assign(__assign({}, result), { dashboards: getCheckedDashboardsUids(sections) });
        }
    }, emptyResults);
};
/**
 * When search is done within a dashboard folder, add folder id to the search query
 * to narrow down the results to the folder
 * @param query
 * @param queryParsing
 */
export var getParsedQuery = function (query, queryParsing) {
    var _a;
    if (queryParsing === void 0) { queryParsing = false; }
    var parsedQuery = __assign(__assign({}, query), { sort: (_a = query.sort) === null || _a === void 0 ? void 0 : _a.value });
    if (!queryParsing) {
        return parsedQuery;
    }
    var folderIds = [];
    if (parseQuery(query.query).folder === 'current') {
        try {
            var dash = getDashboardSrv().getCurrent();
            if (dash === null || dash === void 0 ? void 0 : dash.meta.folderId) {
                folderIds = [dash === null || dash === void 0 ? void 0 : dash.meta.folderId];
            }
        }
        catch (e) {
            console.error(e);
        }
    }
    return __assign(__assign({}, parsedQuery), { query: parseQuery(query.query).text, folderIds: folderIds });
};
/**
 * Check if search query has filters enabled. Excludes folderId
 * @param query
 */
export var hasFilters = function (query) {
    var _a;
    if (!query) {
        return false;
    }
    return Boolean(query.query || ((_a = query.tag) === null || _a === void 0 ? void 0 : _a.length) > 0 || query.starred || query.sort);
};
/**
 * Get section icon depending on expanded state. Currently works for folder icons only
 * @param section
 */
export var getSectionIcon = function (section) {
    if (!hasId(section.title)) {
        return section.icon;
    }
    return section.expanded ? 'folder-open' : 'folder';
};
/**
 * Get storage key for a dashboard folder by its title
 * @param title
 */
export var getSectionStorageKey = function (title) {
    if (title === void 0) { title = 'General'; }
    return SECTION_STORAGE_KEY + "." + title.toLowerCase();
};
/**
 * Remove undefined keys from url params object and format non-primitive values
 * @param params
 * @param folder
 */
export var parseRouteParams = function (params) {
    var _a;
    var cleanedParams = Object.entries(params).reduce(function (obj, _a) {
        var _b;
        var _c = __read(_a, 2), key = _c[0], val = _c[1];
        if (!val) {
            return obj;
        }
        else if (key === 'tag' && !Array.isArray(val)) {
            return __assign(__assign({}, obj), { tag: [val] });
        }
        else if (key === 'sort') {
            return __assign(__assign({}, obj), { sort: { value: val } });
        }
        return __assign(__assign({}, obj), (_b = {}, _b[key] = val, _b));
    }, {});
    if (params.folder) {
        var folderStr = "folder:" + params.folder;
        return __assign(__assign({}, cleanedParams), { query: folderStr + " " + ((_a = cleanedParams.query) !== null && _a !== void 0 ? _a : '').replace(folderStr, '') });
    }
    return __assign({}, cleanedParams);
};
//# sourceMappingURL=utils.js.map