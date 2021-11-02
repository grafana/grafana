import { __extends, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import AppNotificationItem from './AppNotificationItem';
import { notifyApp, clearAppNotification } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification, createWarningNotification, } from '../../copy/appNotification';
import { AppEvents } from '@grafana/data';
import { connect } from 'react-redux';
import { VerticalGroup } from '@grafana/ui';
var mapStateToProps = function (state, props) { return ({
    appNotifications: state.appNotifications.appNotifications,
}); };
var mapDispatchToProps = {
    notifyApp: notifyApp,
    clearAppNotification: clearAppNotification,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var AppNotificationListUnConnected = /** @class */ (function (_super) {
    __extends(AppNotificationListUnConnected, _super);
    function AppNotificationListUnConnected() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClearAppNotification = function (id) {
            _this.props.clearAppNotification(id);
        };
        return _this;
    }
    AppNotificationListUnConnected.prototype.componentDidMount = function () {
        var notifyApp = this.props.notifyApp;
        appEvents.on(AppEvents.alertWarning, function (payload) { return notifyApp(createWarningNotification.apply(void 0, __spreadArray([], __read(payload), false))); });
        appEvents.on(AppEvents.alertSuccess, function (payload) { return notifyApp(createSuccessNotification.apply(void 0, __spreadArray([], __read(payload), false))); });
        appEvents.on(AppEvents.alertError, function (payload) { return notifyApp(createErrorNotification.apply(void 0, __spreadArray([], __read(payload), false))); });
    };
    AppNotificationListUnConnected.prototype.render = function () {
        var _this = this;
        var appNotifications = this.props.appNotifications;
        return (React.createElement("div", { className: "page-alert-list" },
            React.createElement(VerticalGroup, null, appNotifications.map(function (appNotification, index) {
                return (React.createElement(AppNotificationItem, { key: appNotification.id + "-" + index, appNotification: appNotification, onClearNotification: function (id) { return _this.onClearAppNotification(id); } }));
            }))));
    };
    return AppNotificationListUnConnected;
}(PureComponent));
export { AppNotificationListUnConnected };
export var AppNotificationList = connector(AppNotificationListUnConnected);
//# sourceMappingURL=AppNotificationList.js.map