import * as tslib_1 from "tslib";
import { ActionTypes } from './actions';
import { processAclItems } from 'app/core/utils/acl';
export var inititalState = {
    id: 0,
    uid: 'loading',
    title: 'loading',
    url: '',
    canSave: false,
    hasChanged: false,
    version: 1,
    permissions: [],
};
export var folderReducer = function (state, action) {
    if (state === void 0) { state = inititalState; }
    switch (action.type) {
        case ActionTypes.LoadFolder:
            return tslib_1.__assign({}, state, action.payload, { hasChanged: false });
        case ActionTypes.SetFolderTitle:
            return tslib_1.__assign({}, state, { title: action.payload, hasChanged: action.payload.trim().length > 0 });
        case ActionTypes.LoadFolderPermissions:
            return tslib_1.__assign({}, state, { permissions: processAclItems(action.payload) });
    }
    return state;
};
export default {
    folder: folderReducer,
};
//# sourceMappingURL=reducers.js.map