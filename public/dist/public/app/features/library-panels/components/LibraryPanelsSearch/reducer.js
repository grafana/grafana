import { __assign } from "tslib";
import { createAction } from '@reduxjs/toolkit';
export var initialLibraryPanelsSearchState = {
    searchQuery: '',
    panelFilter: [],
    folderFilter: [],
    sortDirection: undefined,
};
export var searchChanged = createAction('libraryPanels/search/searchChanged');
export var sortChanged = createAction('libraryPanels/search/sortChanged');
export var panelFilterChanged = createAction('libraryPanels/search/panelFilterChanged');
export var folderFilterChanged = createAction('libraryPanels/search/folderFilterChanged');
export var libraryPanelsSearchReducer = function (state, action) {
    if (searchChanged.match(action)) {
        return __assign(__assign({}, state), { searchQuery: action.payload });
    }
    if (sortChanged.match(action)) {
        return __assign(__assign({}, state), { sortDirection: action.payload.value });
    }
    if (panelFilterChanged.match(action)) {
        return __assign(__assign({}, state), { panelFilter: action.payload.map(function (p) { return p.id; }) });
    }
    if (folderFilterChanged.match(action)) {
        return __assign(__assign({}, state), { folderFilter: action.payload.map(function (f) { return String(f.id); }) });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map