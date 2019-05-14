import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import { AlertBox } from '../AlertBox/AlertBox';
var AppNotificationItem = /** @class */ (function (_super) {
    tslib_1.__extends(AppNotificationItem, _super);
    function AppNotificationItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AppNotificationItem.prototype.shouldComponentUpdate = function (nextProps) {
        return this.props.appNotification.id !== nextProps.appNotification.id;
    };
    AppNotificationItem.prototype.componentDidMount = function () {
        var _a = this.props, appNotification = _a.appNotification, onClearNotification = _a.onClearNotification;
        setTimeout(function () {
            onClearNotification(appNotification.id);
        }, appNotification.timeout);
    };
    AppNotificationItem.prototype.render = function () {
        var _a = this.props, appNotification = _a.appNotification, onClearNotification = _a.onClearNotification;
        return (React.createElement(AlertBox, { severity: appNotification.severity, title: appNotification.title, text: appNotification.text, icon: appNotification.icon, onClose: function () { return onClearNotification(appNotification.id); } }));
    };
    return AppNotificationItem;
}(Component));
export default AppNotificationItem;
//# sourceMappingURL=AppNotificationItem.js.map