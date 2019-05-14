import * as tslib_1 from "tslib";
import { ActionTypes } from './actions';
import config from 'app/core/config';
export var initialState = {
    invitees: [],
    users: [],
    searchQuery: '',
    canInvite: !config.disableLoginForm && !config.externalUserMngLinkName,
    externalUserMngInfo: config.externalUserMngInfo,
    externalUserMngLinkName: config.externalUserMngLinkName,
    externalUserMngLinkUrl: config.externalUserMngLinkUrl,
    hasFetched: false,
};
export var usersReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    switch (action.type) {
        case ActionTypes.LoadUsers:
            return tslib_1.__assign({}, state, { hasFetched: true, users: action.payload });
        case ActionTypes.LoadInvitees:
            return tslib_1.__assign({}, state, { hasFetched: true, invitees: action.payload });
        case ActionTypes.SetUsersSearchQuery:
            return tslib_1.__assign({}, state, { searchQuery: action.payload });
    }
    return state;
};
export default {
    users: usersReducer,
};
//# sourceMappingURL=reducers.js.map