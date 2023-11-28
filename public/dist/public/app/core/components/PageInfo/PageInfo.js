import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function PageInfo({ info }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container }, info.map((infoItem, index) => (React.createElement(React.Fragment, { key: index },
        React.createElement("div", { className: styles.infoItem },
            React.createElement("div", { className: styles.label }, infoItem.label),
            infoItem.value),
        index + 1 < info.length && React.createElement("div", { "data-testid": "page-info-separator", className: styles.separator }))))));
}
const getStyles = (theme) => {
    return {
        container: css({
            display: 'flex',
            flexDirection: 'row',
            gap: theme.spacing(1.5),
            overflow: 'auto',
        }),
        infoItem: css(Object.assign(Object.assign({}, theme.typography.bodySmall), { display: 'flex', flexDirection: 'column', gap: theme.spacing(0.5) })),
        label: css({
            color: theme.colors.text.secondary,
        }),
        separator: css({
            borderLeft: `1px solid ${theme.colors.border.weak}`,
        }),
    };
};
//# sourceMappingURL=PageInfo.js.map