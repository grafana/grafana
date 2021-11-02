import { __assign } from "tslib";
import { getFlattenedSections, getLookupField, markSelected } from '../utils';
import { FETCH_ITEMS, FETCH_RESULTS, TOGGLE_SECTION, MOVE_SELECTION_DOWN, MOVE_SELECTION_UP, SEARCH_START, FETCH_ITEMS_START, } from './actionTypes';
export var dashboardsSearchState = {
    results: [],
    loading: true,
    initialLoading: true,
    selectedIndex: 0,
};
export var searchReducer = function (state, action) {
    switch (action.type) {
        case SEARCH_START:
            if (!state.loading) {
                return __assign(__assign({}, state), { loading: true });
            }
            return state;
        case FETCH_RESULTS: {
            var results = action.payload;
            // Highlight the first item ('Starred' folder)
            if (results.length > 0) {
                results[0].selected = true;
            }
            return __assign(__assign({}, state), { results: results, loading: false, initialLoading: false });
        }
        case TOGGLE_SECTION: {
            var section_1 = action.payload;
            var lookupField_1 = getLookupField(section_1.title);
            return __assign(__assign({}, state), { results: state.results.map(function (result) {
                    if (section_1[lookupField_1] === result[lookupField_1]) {
                        return __assign(__assign({}, result), { expanded: !result.expanded });
                    }
                    return result;
                }) });
        }
        case FETCH_ITEMS: {
            var _a = action.payload, section_2 = _a.section, items_1 = _a.items;
            return __assign(__assign({}, state), { itemsFetching: false, results: state.results.map(function (result) {
                    if (section_2.id === result.id) {
                        return __assign(__assign({}, result), { items: items_1, itemsFetching: false });
                    }
                    return result;
                }) });
        }
        case FETCH_ITEMS_START: {
            var id_1 = action.payload;
            if (id_1) {
                return __assign(__assign({}, state), { results: state.results.map(function (result) { return (result.id === id_1 ? __assign(__assign({}, result), { itemsFetching: true }) : result); }) });
            }
            return state;
        }
        case MOVE_SELECTION_DOWN: {
            var flatIds = getFlattenedSections(state.results);
            if (state.selectedIndex < flatIds.length - 1) {
                var newIndex = state.selectedIndex + 1;
                var selectedId = flatIds[newIndex];
                return __assign(__assign({}, state), { selectedIndex: newIndex, results: markSelected(state.results, selectedId) });
            }
            return state;
        }
        case MOVE_SELECTION_UP:
            if (state.selectedIndex > 0) {
                var flatIds = getFlattenedSections(state.results);
                var newIndex = state.selectedIndex - 1;
                var selectedId = flatIds[newIndex];
                return __assign(__assign({}, state), { selectedIndex: newIndex, results: markSelected(state.results, selectedId) });
            }
            return state;
        default:
            return state;
    }
};
//# sourceMappingURL=dashboardSearch.js.map