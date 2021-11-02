var _a;
import { __assign, __values } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
export var initialState = {
    appNotifications: [],
};
/**
 * Reducer and action to show toast notifications of various types (success, warnings, errors etc). Use to show
 * transient info to user, like errors that cannot be otherwise handled or success after an action.
 *
 * Use factory functions in core/copy/appNotifications to create the payload.
 */
var appNotificationsSlice = createSlice({
    name: 'appNotifications',
    initialState: initialState,
    reducers: {
        notifyApp: function (state, action) {
            var e_1, _a;
            var newAlert = action.payload;
            try {
                for (var _b = __values(state.appNotifications), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var existingAlert = _c.value;
                    if (newAlert.icon === existingAlert.icon &&
                        newAlert.severity === existingAlert.severity &&
                        newAlert.text === existingAlert.text &&
                        newAlert.title === existingAlert.title &&
                        newAlert.component === existingAlert.component) {
                        return;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            state.appNotifications.push(newAlert);
        },
        clearAppNotification: function (state, action) { return (__assign(__assign({}, state), { appNotifications: state.appNotifications.filter(function (appNotification) { return appNotification.id !== action.payload; }) })); },
    },
});
export var notifyApp = (_a = appNotificationsSlice.actions, _a.notifyApp), clearAppNotification = _a.clearAppNotification;
export var appNotificationsReducer = appNotificationsSlice.reducer;
//# sourceMappingURL=appNotification.js.map