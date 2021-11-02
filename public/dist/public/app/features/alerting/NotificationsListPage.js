import { __awaiter, __generator, __read } from "tslib";
import React, { useState, useEffect } from 'react';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';
import { getBackendSrv } from '@grafana/runtime';
import { useAsyncFn } from 'react-use';
import { appEvents } from 'app/core/core';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { HorizontalGroup, Button, LinkButton } from '@grafana/ui';
import { ShowConfirmModalEvent } from '../../types/events';
var NotificationsListPage = function () {
    var navModel = useNavModel('channels');
    var _a = __read(useState([]), 2), notifications = _a[0], setNotifications = _a[1];
    var getNotifications = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get("/api/alert-notifications")];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    var _b = __read(useAsyncFn(getNotifications), 2), state = _b[0], fetchNotifications = _b[1];
    useEffect(function () {
        fetchNotifications().then(function (res) {
            setNotifications(res);
        });
    }, [fetchNotifications]);
    var deleteNotification = function (id) {
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Delete',
            text: 'Do you want to delete this notification channel?',
            text2: "Deleting this notification channel will not delete from alerts any references to it",
            icon: 'trash-alt',
            confirmText: 'Delete',
            yesText: 'Delete',
            onConfirm: function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    deleteNotificationConfirmed(id);
                    return [2 /*return*/];
                });
            }); },
        }));
    };
    var deleteNotificationConfirmed = function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var notifications;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().delete("/api/alert-notifications/" + id)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, fetchNotifications()];
                case 2:
                    notifications = _a.sent();
                    setNotifications(notifications);
                    return [2 /*return*/];
            }
        });
    }); };
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            state.error && React.createElement("p", null, state.error),
            !!notifications.length && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "page-action-bar" },
                    React.createElement("div", { className: "page-action-bar__spacer" }),
                    React.createElement(LinkButton, { icon: "channel-add", href: "alerting/notification/new" }, "New channel")),
                React.createElement("table", { className: "filter-table filter-table--hover" },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", { style: { minWidth: '200px' } },
                                React.createElement("strong", null, "Name")),
                            React.createElement("th", { style: { minWidth: '100px' } }, "Type"),
                            React.createElement("th", { style: { width: '1%' } }))),
                    React.createElement("tbody", null, notifications.map(function (notification) { return (React.createElement("tr", { key: notification.id },
                        React.createElement("td", { className: "link-td" },
                            React.createElement("a", { href: "alerting/notification/" + notification.id + "/edit" }, notification.name)),
                        React.createElement("td", { className: "link-td" },
                            React.createElement("a", { href: "alerting/notification/" + notification.id + "/edit" }, notification.type)),
                        React.createElement("td", { className: "text-right" },
                            React.createElement(HorizontalGroup, { justify: "flex-end" },
                                notification.isDefault && (React.createElement(Button, { disabled: true, variant: "secondary", size: "sm" }, "default")),
                                React.createElement(Button, { variant: "destructive", icon: "times", size: "sm", onClick: function () {
                                        deleteNotification(notification.id);
                                    } }))))); }))))),
            !(notifications.length || state.loading) && (React.createElement(EmptyListCTA, { title: "There are no notification channels defined yet", buttonIcon: "channel-add", buttonLink: "alerting/notification/new", buttonTitle: "Add channel", proTip: "You can include images in your alert notifications.", proTipLink: "http://docs.grafana.org/alerting/notifications/", proTipLinkTitle: "Learn more", proTipTarget: "_blank" })))));
};
export default NotificationsListPage;
//# sourceMappingURL=NotificationsListPage.js.map