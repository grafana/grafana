import { __read } from "tslib";
import { useCallback, useEffect } from 'react';
import { useDebounce } from 'react-use';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { FETCH_RESULTS, FETCH_ITEMS, TOGGLE_SECTION, SEARCH_START, FETCH_ITEMS_START } from '../reducers/actionTypes';
import { hasId, getParsedQuery } from '../utils';
var searchSrv = new SearchSrv();
/**
 * Base hook for search functionality.
 * Returns state and dispatch, among others, from 'reducer' param, so it can be
 * further extended.
 * @param query
 * @param reducer - return result of useReducer
 * @param params - custom params
 */
export var useSearch = function (query, reducer, params) {
    if (params === void 0) { params = {}; }
    var queryParsing = params.queryParsing;
    var _a = __read(reducer, 2), state = _a[0], dispatch = _a[1];
    var search = function () {
        dispatch({ type: SEARCH_START });
        var parsedQuery = getParsedQuery(query, queryParsing);
        searchSrv.search(parsedQuery).then(function (results) {
            dispatch({ type: FETCH_RESULTS, payload: results });
        });
    };
    // Set loading state before debounced search
    useEffect(function () {
        dispatch({ type: SEARCH_START });
    }, [query.tag, query.sort, query.starred, query.layout, dispatch]);
    useDebounce(search, 300, [query, queryParsing]);
    var onToggleSection = useCallback(function (section) {
        if (hasId(section.title) && !section.items.length) {
            dispatch({ type: FETCH_ITEMS_START, payload: section.id });
            backendSrv.search({ folderIds: [section.id] }).then(function (items) {
                dispatch({ type: FETCH_ITEMS, payload: { section: section, items: items } });
                dispatch({ type: TOGGLE_SECTION, payload: section });
            });
        }
        else {
            dispatch({ type: TOGGLE_SECTION, payload: section });
        }
    }, [dispatch]);
    return { state: state, dispatch: dispatch, onToggleSection: onToggleSection };
};
//# sourceMappingURL=useSearch.js.map