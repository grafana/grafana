import { createAction } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';
export const initialLibraryPanelsViewState = {
    loadingState: LoadingState.Loading,
    libraryPanels: [],
    totalCount: 0,
    perPage: 40,
    page: 1,
    numberOfPages: 0,
    currentPanelId: undefined,
};
export const initSearch = createAction('libraryPanels/view/initSearch');
export const searchCompleted = createAction('libraryPanels/view/searchCompleted');
export const changePage = createAction('libraryPanels/view/changePage');
export const libraryPanelsViewReducer = (state, action) => {
    if (initSearch.match(action)) {
        return Object.assign(Object.assign({}, state), { loadingState: LoadingState.Loading });
    }
    if (searchCompleted.match(action)) {
        const { libraryPanels, page, perPage, totalCount } = action.payload;
        const numberOfPages = Math.ceil(totalCount / perPage);
        return Object.assign(Object.assign({}, state), { libraryPanels,
            perPage,
            totalCount, loadingState: LoadingState.Done, numberOfPages, page: page > numberOfPages ? page - 1 : page });
    }
    if (changePage.match(action)) {
        return Object.assign(Object.assign({}, state), { page: action.payload.page });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map