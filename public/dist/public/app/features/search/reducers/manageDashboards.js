import { __assign, __read, __spreadArray } from "tslib";
import { TOGGLE_ALL_CHECKED, TOGGLE_CHECKED, MOVE_ITEMS, DELETE_ITEMS } from './actionTypes';
import { dashboardsSearchState, searchReducer } from './dashboardSearch';
import { mergeReducers } from '../utils';
export var manageDashboardsState = __assign(__assign({}, dashboardsSearchState), { allChecked: false });
var reducer = function (state, action) {
    switch (action.type) {
        case TOGGLE_ALL_CHECKED:
            var newAllChecked_1 = !state.allChecked;
            return __assign(__assign({}, state), { results: state.results.map(function (result) {
                    return __assign(__assign({}, result), { checked: newAllChecked_1, items: result.items.map(function (item) { return (__assign(__assign({}, item), { checked: newAllChecked_1 })); }) });
                }), allChecked: newAllChecked_1 });
        case TOGGLE_CHECKED:
            var id_1 = action.payload.id;
            return __assign(__assign({}, state), { results: state.results.map(function (result) {
                    if (result.id === id_1) {
                        return __assign(__assign({}, result), { checked: !result.checked, items: result.items.map(function (item) { return (__assign(__assign({}, item), { checked: !result.checked })); }) });
                    }
                    return __assign(__assign({}, result), { items: result.items.map(function (item) { return (item.id === id_1 ? __assign(__assign({}, item), { checked: !item.checked }) : item); }) });
                }) });
        case MOVE_ITEMS: {
            var dashboards_1 = action.payload.dashboards;
            var folder_1 = action.payload.folder;
            var uids_1 = dashboards_1.map(function (db) { return db.uid; });
            return __assign(__assign({}, state), { results: state.results.map(function (result) {
                    if (folder_1.id === result.id) {
                        return result.expanded
                            ? __assign(__assign({}, result), { items: __spreadArray(__spreadArray([], __read(result.items), false), __read(dashboards_1.map(function (db) { return (__assign(__assign({}, db), { checked: false })); })), false), checked: false }) : result;
                    }
                    else {
                        return __assign(__assign({}, result), { items: result.items.filter(function (item) { return !uids_1.includes(item.uid); }) });
                    }
                }) });
        }
        case DELETE_ITEMS: {
            var _a = action.payload, folders_1 = _a.folders, dashboards_2 = _a.dashboards;
            if (!folders_1.length && !dashboards_2.length) {
                return state;
            }
            return __assign(__assign({}, state), { results: state.results.reduce(function (filtered, result) {
                    if (!folders_1.includes(result.uid)) {
                        return __spreadArray(__spreadArray([], __read(filtered), false), [__assign(__assign({}, result), { items: result.items.filter(function (item) { return !dashboards_2.includes(item.uid); }) })], false);
                    }
                    return filtered;
                }, []) });
        }
        default:
            return state;
    }
};
export var manageDashboardsReducer = mergeReducers([searchReducer, reducer]);
//# sourceMappingURL=manageDashboards.js.map