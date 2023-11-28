export var AppNotificationSeverity;
(function (AppNotificationSeverity) {
    AppNotificationSeverity["Success"] = "success";
    AppNotificationSeverity["Warning"] = "warning";
    AppNotificationSeverity["Error"] = "error";
    AppNotificationSeverity["Info"] = "info";
})(AppNotificationSeverity || (AppNotificationSeverity = {}));
export var AppNotificationTimeout;
(function (AppNotificationTimeout) {
    AppNotificationTimeout[AppNotificationTimeout["Success"] = 3000] = "Success";
    AppNotificationTimeout[AppNotificationTimeout["Warning"] = 5000] = "Warning";
    AppNotificationTimeout[AppNotificationTimeout["Error"] = 7000] = "Error";
})(AppNotificationTimeout || (AppNotificationTimeout = {}));
export const timeoutMap = {
    [AppNotificationSeverity.Success]: AppNotificationTimeout.Success,
    [AppNotificationSeverity.Warning]: AppNotificationTimeout.Warning,
    [AppNotificationSeverity.Error]: AppNotificationTimeout.Error,
    [AppNotificationSeverity.Info]: AppNotificationTimeout.Success,
};
//# sourceMappingURL=appNotifications.js.map