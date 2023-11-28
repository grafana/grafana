import { __awaiter } from "tslib";
import React, { useState, useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { HorizontalGroup, Button, LinkButton } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { appEvents } from 'app/core/core';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { ShowConfirmModalEvent } from '../../types/events';
const NotificationsListPage = () => {
    const navModel = useNavModel('channels');
    const [notifications, setNotifications] = useState([]);
    const getNotifications = () => __awaiter(void 0, void 0, void 0, function* () {
        return yield getBackendSrv().get(`/api/alert-notifications`);
    });
    const [state, fetchNotifications] = useAsyncFn(getNotifications);
    useEffect(() => {
        fetchNotifications().then((res) => {
            setNotifications(res);
        });
    }, [fetchNotifications]);
    const deleteNotification = (id) => {
        appEvents.publish(new ShowConfirmModalEvent({
            title: 'Delete',
            text: 'Do you want to delete this notification channel?',
            text2: `Deleting this notification channel will not delete from alerts any references to it`,
            icon: 'trash-alt',
            confirmText: 'Delete',
            yesText: 'Delete',
            onConfirm: () => __awaiter(void 0, void 0, void 0, function* () {
                deleteNotificationConfirmed(id);
            }),
        }));
    };
    const deleteNotificationConfirmed = (id) => __awaiter(void 0, void 0, void 0, function* () {
        yield getBackendSrv().delete(`/api/alert-notifications/${id}`);
        const notifications = yield fetchNotifications();
        setNotifications(notifications);
    });
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            state.error && React.createElement("p", null, state.error.message),
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
                    React.createElement("tbody", null, notifications.map((notification) => (React.createElement("tr", { key: notification.id },
                        React.createElement("td", { className: "link-td" },
                            React.createElement("a", { href: `alerting/notification/${notification.id}/edit` }, notification.name)),
                        React.createElement("td", { className: "link-td" },
                            React.createElement("a", { href: `alerting/notification/${notification.id}/edit` }, notification.type)),
                        React.createElement("td", { className: "text-right" },
                            React.createElement(HorizontalGroup, { justify: "flex-end" },
                                notification.isDefault && (React.createElement(Button, { disabled: true, variant: "secondary", size: "sm" }, "default")),
                                React.createElement(Button, { variant: "destructive", icon: "times", size: "sm", onClick: () => {
                                        deleteNotification(notification.id);
                                    } })))))))))),
            !(notifications.length || state.loading) && (React.createElement(EmptyListCTA, { title: "There are no notification channels defined yet", buttonIcon: "channel-add", buttonLink: "alerting/notification/new", buttonTitle: "Add channel", proTip: "You can include images in your alert notifications.", proTipLink: "http://docs.grafana.org/alerting/notifications/", proTipLinkTitle: "Learn more", proTipTarget: "_blank" })))));
};
export default NotificationsListPage;
//# sourceMappingURL=NotificationsListPage.js.map