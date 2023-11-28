import { css } from '@emotion/css';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { Card, Checkbox, useTheme2 } from '@grafana/ui';
export const StoredNotificationItem = ({ children, className, isSelected, onClick, severity = 'error', title, traceId, timestamp, }) => {
    const theme = useTheme2();
    const styles = getStyles(theme);
    return (React.createElement(Card, { className: className, onClick: onClick },
        React.createElement(Card.Heading, null, title),
        React.createElement(Card.Description, null, children),
        React.createElement(Card.Figure, null,
            React.createElement(Checkbox, { onChange: onClick, tabIndex: -1, value: isSelected })),
        React.createElement(Card.Tags, { className: styles.trace },
            traceId && React.createElement("span", null, `Trace ID: ${traceId}`),
            timestamp && formatDistanceToNow(timestamp, { addSuffix: true }))));
};
const getStyles = (theme) => {
    return {
        trace: css({
            alignItems: 'flex-end',
            alignSelf: 'flex-end',
            color: theme.colors.text.secondary,
            display: 'flex',
            flexDirection: 'column',
            fontSize: theme.typography.pxToRem(10),
            justifySelf: 'flex-end',
        }),
    };
};
//# sourceMappingURL=StoredNotificationItem.js.map