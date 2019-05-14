import * as tslib_1 from "tslib";
import { ActionTypes } from '../actions/appNotification';
export var initialState = {
    appNotifications: [],
};
export var appNotificationsReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    switch (action.type) {
        case ActionTypes.AddAppNotification:
            return tslib_1.__assign({}, state, { appNotifications: state.appNotifications.concat([action.payload]) });
        case ActionTypes.ClearAppNotification:
            return tslib_1.__assign({}, state, { appNotifications: state.appNotifications.filter(function (appNotification) { return appNotification.id !== action.payload; }) });
    }
    return state;
};
//# sourceMappingURL=appNotification.js.map