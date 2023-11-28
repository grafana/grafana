import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { AppEvents } from '@grafana/data';
import { useStyles2, VerticalGroup } from '@grafana/ui';
import { notifyApp, hideAppNotification } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { selectVisible } from 'app/core/reducers/appNotification';
import { useSelector, useDispatch } from 'app/types';
import { createErrorNotification, createSuccessNotification, createWarningNotification, } from '../../copy/appNotification';
import AppNotificationItem from './AppNotificationItem';
export function AppNotificationList() {
    const appNotifications = useSelector((state) => selectVisible(state.appNotifications));
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    useEffect(() => {
        appEvents.on(AppEvents.alertWarning, (payload) => dispatch(notifyApp(createWarningNotification(...payload))));
        appEvents.on(AppEvents.alertSuccess, (payload) => dispatch(notifyApp(createSuccessNotification(...payload))));
        appEvents.on(AppEvents.alertError, (payload) => dispatch(notifyApp(createErrorNotification(...payload))));
    }, [dispatch]);
    const onClearAppNotification = (id) => {
        dispatch(hideAppNotification(id));
    };
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(VerticalGroup, null, appNotifications.map((appNotification, index) => {
            return (React.createElement(AppNotificationItem, { key: `${appNotification.id}-${index}`, appNotification: appNotification, onClearNotification: onClearAppNotification }));
        }))));
}
function getStyles(theme) {
    return {
        wrapper: css({
            label: 'app-notifications-list',
            zIndex: theme.zIndex.portal,
            minWidth: 400,
            maxWidth: 600,
            position: 'fixed',
            right: 6,
            top: 88,
        }),
    };
}
//# sourceMappingURL=AppNotificationList.js.map