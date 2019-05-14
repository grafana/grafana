import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import appEvents from 'app/core/app_events';
import AppNotificationItem from './AppNotificationItem';
import { notifyApp, clearAppNotification } from 'app/core/actions';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { createErrorNotification, createSuccessNotification, createWarningNotification, } from '../../copy/appNotification';
var AppNotificationList = /** @class */ (function (_super) {
    tslib_1.__extends(AppNotificationList, _super);
    function AppNotificationList() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClearAppNotification = function (id) {
            _this.props.clearAppNotification(id);
        };
        return _this;
    }
    AppNotificationList.prototype.componentDidMount = function () {
        var notifyApp = this.props.notifyApp;
        appEvents.on('alert-warning', function (options) { return notifyApp(createWarningNotification(options[0], options[1])); });
        appEvents.on('alert-success', function (options) { return notifyApp(createSuccessNotification(options[0], options[1])); });
        appEvents.on('alert-error', function (options) { return notifyApp(createErrorNotification(options[0], options[1])); });
    };
    AppNotificationList.prototype.render = function () {
        var _this = this;
        var appNotifications = this.props.appNotifications;
        return (React.createElement("div", null, appNotifications.map(function (appNotification, index) {
            return (React.createElement(AppNotificationItem, { key: appNotification.id + "-" + index, appNotification: appNotification, onClearNotification: function (id) { return _this.onClearAppNotification(id); } }));
        })));
    };
    return AppNotificationList;
}(PureComponent));
export { AppNotificationList };
var mapStateToProps = function (state) { return ({
    appNotifications: state.appNotifications.appNotifications,
}); };
var mapDispatchToProps = {
    notifyApp: notifyApp,
    clearAppNotification: clearAppNotification,
};
export default connectWithStore(AppNotificationList, mapStateToProps, mapDispatchToProps);
//# sourceMappingURL=AppNotificationList.js.map