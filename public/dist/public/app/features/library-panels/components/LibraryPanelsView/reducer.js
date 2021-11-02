import { __assign } from "tslib";
import { createAction } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';
export var initialLibraryPanelsViewState = {
    loadingState: LoadingState.Loading,
    libraryPanels: [],
    totalCount: 0,
    perPage: 40,
    page: 1,
    numberOfPages: 0,
    currentPanelId: undefined,
};
export var initSearch = createAction('libraryPanels/view/initSearch');
export var searchCompleted = createAction('libraryPanels/view/searchCompleted');
export var changePage = createAction('libraryPanels/view/changePage');
export var libraryPanelsViewReducer = function (state, action) {
    if (initSearch.match(action)) {
        return __assign(__assign({}, state), { loadingState: LoadingState.Loading });
    }
    if (searchCompleted.match(action)) {
        var _a = action.payload, libraryPanels = _a.libraryPanels, page = _a.page, perPage = _a.perPage, totalCount = _a.totalCount;
        var numberOfPages = Math.ceil(totalCount / perPage);
        return __assign(__assign({}, state), { libraryPanels: libraryPanels, perPage: perPage, totalCount: totalCount, loadingState: LoadingState.Done, numberOfPages: numberOfPages, page: page > numberOfPages ? page - 1 : page });
    }
    if (changePage.match(action)) {
        return __assign(__assign({}, state), { page: action.payload.page });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map