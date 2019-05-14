export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["AddAppNotification"] = "ADD_APP_NOTIFICATION";
    ActionTypes["ClearAppNotification"] = "CLEAR_APP_NOTIFICATION";
})(ActionTypes || (ActionTypes = {}));
export var clearAppNotification = function (appNotificationId) { return ({
    type: ActionTypes.ClearAppNotification,
    payload: appNotificationId,
}); };
export var notifyApp = function (appNotification) { return ({
    type: ActionTypes.AddAppNotification,
    payload: appNotification,
}); };
//# sourceMappingURL=appNotification.js.map