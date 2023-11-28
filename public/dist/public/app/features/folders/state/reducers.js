import { createSlice } from '@reduxjs/toolkit';
import { processAclItems } from 'app/core/utils/acl';
import { endpoints } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
export const initialState = {
    id: 0,
    uid: 'loading',
    title: 'loading',
    url: '',
    canSave: false,
    canDelete: false,
    hasChanged: false,
    version: 1,
    permissions: [],
    canViewFolderPermissions: false,
};
const loadFolderReducer = (state, action) => {
    return Object.assign(Object.assign(Object.assign({}, state), action.payload), { hasChanged: false });
};
const folderSlice = createSlice({
    name: 'folder',
    initialState,
    reducers: {
        loadFolder: loadFolderReducer,
        setFolderTitle: (state, action) => {
            return Object.assign(Object.assign({}, state), { title: action.payload, hasChanged: action.payload.trim().length > 0 });
        },
        loadFolderPermissions: (state, action) => {
            return Object.assign(Object.assign({}, state), { permissions: processAclItems(action.payload) });
        },
        setCanViewFolderPermissions: (state, action) => {
            state.canViewFolderPermissions = action.payload;
            return state;
        },
    },
    extraReducers: (builder) => {
        builder.addMatcher(endpoints.getFolder.matchFulfilled, loadFolderReducer);
    },
});
export const { loadFolderPermissions, loadFolder, setFolderTitle, setCanViewFolderPermissions } = folderSlice.actions;
export const folderReducer = folderSlice.reducer;
export default {
    folder: folderReducer,
};
//# sourceMappingURL=reducers.js.map