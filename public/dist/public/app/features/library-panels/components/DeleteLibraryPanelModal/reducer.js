import { createAction } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';
export const initialDeleteLibraryPanelModalState = {
    loadingState: LoadingState.Loading,
    dashboardTitles: [],
};
export const searchCompleted = createAction('libraryPanels/delete/searchCompleted');
export const deleteLibraryPanelModalReducer = (state = initialDeleteLibraryPanelModalState, action) => {
    if (searchCompleted.match(action)) {
        return Object.assign(Object.assign({}, state), { dashboardTitles: action.payload.dashboards.map((d) => d.title), loadingState: LoadingState.Done });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map