import { useReducer } from 'react';
import { getLocationSrv } from '@grafana/runtime';
import { DashboardSearchItemType } from '../types';
import { MOVE_SELECTION_DOWN, MOVE_SELECTION_UP } from '../reducers/actionTypes';
import { dashboardsSearchState, searchReducer } from '../reducers/dashboardSearch';
import { findSelected } from '../utils';
import { useSearch } from './useSearch';
import { locationUtil } from '@grafana/data';
export var useDashboardSearch = function (query, onCloseSearch) {
    var reducer = useReducer(searchReducer, dashboardsSearchState);
    var _a = useSearch(query, reducer, { queryParsing: true }), _b = _a.state, results = _b.results, loading = _b.loading, onToggleSection = _a.onToggleSection, dispatch = _a.dispatch;
    var onKeyDown = function (event) {
        switch (event.key) {
            case 'Escape':
                onCloseSearch();
                break;
            case 'ArrowUp':
                dispatch({ type: MOVE_SELECTION_UP });
                break;
            case 'ArrowDown':
                dispatch({ type: MOVE_SELECTION_DOWN });
                break;
            case 'Enter':
                var selectedItem = findSelected(results);
                if (selectedItem) {
                    if (selectedItem.type === DashboardSearchItemType.DashFolder) {
                        onToggleSection(selectedItem);
                    }
                    else {
                        getLocationSrv().update({
                            path: locationUtil.stripBaseFromUrl(selectedItem.url),
                        });
                        // Delay closing to prevent current page flicker
                        setTimeout(onCloseSearch, 0);
                    }
                }
        }
    };
    return {
        results: results,
        loading: loading,
        onToggleSection: onToggleSection,
        onKeyDown: onKeyDown,
    };
};
//# sourceMappingURL=useDashboardSearch.js.map