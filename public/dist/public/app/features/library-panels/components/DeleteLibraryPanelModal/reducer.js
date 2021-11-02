import { __assign } from "tslib";
import { LoadingState } from '@grafana/data';
import { createAction } from '@reduxjs/toolkit';
export var initialDeleteLibraryPanelModalState = {
    loadingState: LoadingState.Loading,
    dashboardTitles: [],
};
export var searchCompleted = createAction('libraryPanels/delete/searchCompleted');
export var deleteLibraryPanelModalReducer = function (state, action) {
    if (state === void 0) { state = initialDeleteLibraryPanelModalState; }
    if (searchCompleted.match(action)) {
        return __assign(__assign({}, state), { dashboardTitles: action.payload.dashboards.map(function (d) { return d.title; }), loadingState: LoadingState.Done });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map