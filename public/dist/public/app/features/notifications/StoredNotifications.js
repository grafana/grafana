import { css, cx } from '@emotion/css';
import React, { useRef, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { Alert, Button, Checkbox, Icon, useStyles2 } from '@grafana/ui';
import { StoredNotificationItem } from 'app/core/components/AppNotifications/StoredNotificationItem';
import { clearAllNotifications, clearNotification, readAllNotifications, selectWarningsAndErrors, selectLastReadTimestamp, } from 'app/core/reducers/appNotification';
import { useDispatch, useSelector } from 'app/types';
export function StoredNotifications() {
    const dispatch = useDispatch();
    const notifications = useSelector((state) => selectWarningsAndErrors(state.appNotifications));
    const [selectedNotificationIds, setSelectedNotificationIds] = useState([]);
    const allNotificationsSelected = notifications.every((notification) => selectedNotificationIds.includes(notification.id));
    const lastReadTimestamp = useRef(useSelector((state) => selectLastReadTimestamp(state.appNotifications)));
    const styles = useStyles2(getStyles);
    useEffectOnce(() => {
        dispatch(readAllNotifications(Date.now()));
    });
    const clearSelectedNotifications = () => {
        if (allNotificationsSelected) {
            dispatch(clearAllNotifications());
        }
        else {
            selectedNotificationIds.forEach((id) => {
                dispatch(clearNotification(id));
            });
        }
        setSelectedNotificationIds([]);
    };
    const handleAllCheckboxToggle = (isChecked) => {
        setSelectedNotificationIds(isChecked ? notifications.map((n) => n.id) : []);
    };
    const handleCheckboxToggle = (id) => {
        setSelectedNotificationIds((prevState) => {
            if (!prevState.includes(id)) {
                return [...prevState, id];
            }
            else {
                return prevState.filter((notificationId) => notificationId !== id);
            }
        });
    };
    if (notifications.length === 0) {
        return (React.createElement("div", { className: styles.noNotifsWrapper },
            React.createElement(Icon, { name: "bell", size: "xxl" }),
            React.createElement("span", null, "Notifications you have received will appear here.")));
    }
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(Alert, { severity: "info", title: "This page displays past errors and warnings. Once dismissed, they cannot be retrieved." }),
        React.createElement("div", { className: styles.topRow },
            React.createElement(Checkbox, { value: allNotificationsSelected, onChange: (event) => handleAllCheckboxToggle(event.target.checked) }),
            React.createElement(Button, { disabled: selectedNotificationIds.length === 0, onClick: clearSelectedNotifications }, "Dismiss notifications")),
        React.createElement("ul", { className: styles.list }, notifications.map((notif) => (React.createElement("li", { key: notif.id, className: styles.listItem },
            React.createElement(StoredNotificationItem, { className: cx({ [styles.newItem]: notif.timestamp > lastReadTimestamp.current }), isSelected: selectedNotificationIds.includes(notif.id), onClick: () => handleCheckboxToggle(notif.id), severity: notif.severity, title: notif.title, timestamp: notif.timestamp, traceId: notif.traceId },
                React.createElement("span", null, notif.text))))))));
}
function getStyles(theme) {
    return {
        topRow: css({
            alignItems: 'center',
            display: 'flex',
            gap: theme.spacing(2),
        }),
        list: css({
            display: 'flex',
            flexDirection: 'column',
        }),
        listItem: css({
            alignItems: 'center',
            display: 'flex',
            gap: theme.spacing(2),
            listStyle: 'none',
            position: 'relative',
        }),
        newItem: css({
            '&::before': {
                content: '""',
                height: '100%',
                position: 'absolute',
                left: '-7px',
                top: 0,
                background: theme.colors.gradients.brandVertical,
                width: theme.spacing(0.5),
                borderRadius: theme.shape.radius.default,
            },
        }),
        noNotifsWrapper: css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing(1),
        }),
        wrapper: css({
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(2),
        }),
    };
}
//# sourceMappingURL=StoredNotifications.js.map