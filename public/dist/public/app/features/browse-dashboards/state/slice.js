import { __rest } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { fetchNextChildrenPage, refetchChildren } from './actions';
import * as allReducers from './reducers';
const { fetchNextChildrenPageFulfilled, refetchChildrenFulfilled } = allReducers, baseReducers = __rest(allReducers, ["fetchNextChildrenPageFulfilled", "refetchChildrenFulfilled"]);
const initialState = {
    rootItems: undefined,
    childrenByParentUID: {},
    openFolders: {},
    selectedItems: {
        dashboard: {},
        folder: {},
        panel: {},
        $all: false,
    },
};
const browseDashboardsSlice = createSlice({
    name: 'browseDashboards',
    initialState,
    reducers: baseReducers,
    extraReducers: (builder) => {
        builder.addCase(fetchNextChildrenPage.fulfilled, fetchNextChildrenPageFulfilled);
        builder.addCase(refetchChildren.fulfilled, refetchChildrenFulfilled);
    },
});
export const browseDashboardsReducer = browseDashboardsSlice.reducer;
export const { setFolderOpenState, setItemSelectionState, setAllSelection } = browseDashboardsSlice.actions;
export default {
    browseDashboards: browseDashboardsReducer,
};
//# sourceMappingURL=slice.js.map