import { __extends } from "tslib";
import React, { Component } from 'react';
import { Alert } from '@grafana/ui';
var AppNotificationItem = /** @class */ (function (_super) {
    __extends(AppNotificationItem, _super);
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
        return (React.createElement(Alert, { severity: appNotification.severity, title: appNotification.title, onRemove: function () { return onClearNotification(appNotification.id); }, elevated: true }, appNotification.component || appNotification.text));
    };
    return AppNotificationItem;
}(Component));
export default AppNotificationItem;
//# sourceMappingURL=AppNotificationItem.js.map