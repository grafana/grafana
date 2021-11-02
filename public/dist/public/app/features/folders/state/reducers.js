var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
import { processAclItems } from 'app/core/utils/acl';
export var initialState = {
    id: 0,
    uid: 'loading',
    title: 'loading',
    url: '',
    canSave: false,
    hasChanged: false,
    version: 1,
    permissions: [],
};
var folderSlice = createSlice({
    name: 'folder',
    initialState: initialState,
    reducers: {
        loadFolder: function (state, action) {
            return __assign(__assign(__assign({}, state), action.payload), { hasChanged: false });
        },
        setFolderTitle: function (state, action) {
            return __assign(__assign({}, state), { title: action.payload, hasChanged: action.payload.trim().length > 0 });
        },
        loadFolderPermissions: function (state, action) {
            return __assign(__assign({}, state), { permissions: processAclItems(action.payload) });
        },
    },
});
export var loadFolderPermissions = (_a = folderSlice.actions, _a.loadFolderPermissions), loadFolder = _a.loadFolder, setFolderTitle = _a.setFolderTitle;
export var folderReducer = folderSlice.reducer;
export default {
    folder: folderReducer,
};
//# sourceMappingURL=reducers.js.map