import { css } from '@emotion/css';
import React from 'react';
import { useEffectOnce } from 'react-use';
import { Alert, useStyles2 } from '@grafana/ui';
import { timeoutMap } from 'app/types';
export default function AppNotificationItem({ appNotification, onClearNotification }) {
    const styles = useStyles2(getStyles);
    useEffectOnce(() => {
        setTimeout(() => {
            onClearNotification(appNotification.id);
        }, timeoutMap[appNotification.severity]);
    });
    const hasBody = appNotification.component || appNotification.text || appNotification.traceId;
    return (React.createElement(Alert, { severity: appNotification.severity, title: appNotification.title, onRemove: () => onClearNotification(appNotification.id), elevated: true }, hasBody && (React.createElement("div", { className: styles.wrapper },
        React.createElement("span", null, appNotification.component || appNotification.text),
        appNotification.traceId && React.createElement("span", { className: styles.trace },
            "Trace ID: ",
            appNotification.traceId)))));
}
function getStyles(theme) {
    return {
        wrapper: css({
            display: 'flex',
            flexDirection: 'column',
        }),
        trace: css({
            fontSize: theme.typography.pxToRem(10),
        }),
    };
}
//# sourceMappingURL=AppNotificationItem.js.map