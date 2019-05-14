import { coreModule } from 'app/core/core';
var AlertNotificationsListCtrl = /** @class */ (function () {
    /** @ngInject */
    function AlertNotificationsListCtrl(backendSrv, navModelSrv) {
        this.backendSrv = backendSrv;
        this.loadNotifications();
        this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
    }
    AlertNotificationsListCtrl.prototype.loadNotifications = function () {
        var _this = this;
        this.backendSrv.get("/api/alert-notifications").then(function (result) {
            _this.notifications = result;
        });
    };
    AlertNotificationsListCtrl.prototype.deleteNotification = function (id) {
        var _this = this;
        this.backendSrv.delete("/api/alert-notifications/" + id).then(function () {
            _this.notifications = _this.notifications.filter(function (notification) {
                return notification.id !== id;
            });
        });
    };
    return AlertNotificationsListCtrl;
}());
export { AlertNotificationsListCtrl };
coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);
//# sourceMappingURL=NotificationsListCtrl.js.map