import { __assign, __read, __spreadArray } from "tslib";
import { useCallback, useReducer } from 'react';
import { debounce } from 'lodash';
import { locationService } from '@grafana/runtime';
import { defaultQuery, defaultQueryParams, queryReducer } from '../reducers/searchQueryReducer';
import { ADD_TAG, CLEAR_FILTERS, LAYOUT_CHANGE, QUERY_CHANGE, SET_TAGS, TOGGLE_SORT, TOGGLE_STARRED, } from '../reducers/actionTypes';
import { SearchLayout } from '../types';
import { hasFilters, parseRouteParams } from '../utils';
var updateLocation = debounce(function (query) { return locationService.partial(query); }, 300);
export var useSearchQuery = function (defaults) {
    var queryParams = parseRouteParams(locationService.getSearchObject());
    var initialState = __assign(__assign(__assign({}, defaultQuery), defaults), queryParams);
    var _a = __read(useReducer(queryReducer, initialState), 2), query = _a[0], dispatch = _a[1];
    var onQueryChange = function (query) {
        dispatch({ type: QUERY_CHANGE, payload: query });
        updateLocation({ query: query });
    };
    var onTagFilterChange = function (tags) {
        dispatch({ type: SET_TAGS, payload: tags });
        updateLocation({ tag: tags });
    };
    var onTagAdd = useCallback(function (tag) {
        dispatch({ type: ADD_TAG, payload: tag });
        updateLocation({ tag: __spreadArray(__spreadArray([], __read(query.tag), false), [tag], false) });
    }, [query.tag]);
    var onClearFilters = function () {
        dispatch({ type: CLEAR_FILTERS });
        updateLocation(defaultQueryParams);
    };
    var onStarredFilterChange = function (e) {
        var starred = e.target.checked;
        dispatch({ type: TOGGLE_STARRED, payload: starred });
        updateLocation({ starred: starred || null });
    };
    var onSortChange = function (sort) {
        dispatch({ type: TOGGLE_SORT, payload: sort });
        updateLocation({ sort: sort === null || sort === void 0 ? void 0 : sort.value, layout: SearchLayout.List });
    };
    var onLayoutChange = function (layout) {
        dispatch({ type: LAYOUT_CHANGE, payload: layout });
        if (layout === SearchLayout.Folders) {
            updateLocation({ layout: layout, sort: null });
            return;
        }
        updateLocation({ layout: layout });
    };
    return {
        query: query,
        hasFilters: hasFilters(query),
        onQueryChange: onQueryChange,
        onClearFilters: onClearFilters,
        onTagFilterChange: onTagFilterChange,
        onStarredFilterChange: onStarredFilterChange,
        onTagAdd: onTagAdd,
        onSortChange: onSortChange,
        onLayoutChange: onLayoutChange,
    };
};
//# sourceMappingURL=useSearchQuery.js.map