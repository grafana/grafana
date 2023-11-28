import { css } from '@emotion/css';
import React from 'react';
import { Icon, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';
export const PanelHeaderNotice = ({ notice, onClick }) => {
    const styles = useStyles2(getStyles);
    const iconName = notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'file-landscape-alt';
    if (notice.inspect && onClick) {
        return (React.createElement(ToolbarButton, { className: styles.notice, icon: iconName, iconSize: "md", key: notice.severity, tooltip: notice.text, onClick: (e) => onClick(e, notice.inspect) }));
    }
    if (notice.link) {
        return (React.createElement("a", { className: styles.notice, "aria-label": notice.text, href: notice.link, target: "_blank", rel: "noreferrer" },
            React.createElement(Icon, { name: iconName, style: { marginRight: '8px' }, size: "md" })));
    }
    return (React.createElement(Tooltip, { key: notice.severity, content: notice.text },
        React.createElement("span", { className: styles.iconTooltip },
            React.createElement(Icon, { name: iconName, size: "md" }))));
};
const getStyles = (theme) => ({
    notice: css({
        background: 'inherit',
        border: 'none',
        borderRadius: theme.shape.radius.default,
    }),
    iconTooltip: css({
        color: `${theme.colors.text.secondary}`,
        backgroundColor: 'inherit',
        cursor: 'auto',
        border: 'none',
        borderRadius: `${theme.shape.radius.default}`,
        padding: `${theme.spacing(0, 1)}`,
        height: ` ${theme.spacing(theme.components.height.md)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:focus, &:focus-visible': Object.assign(Object.assign({}, getFocusStyles(theme)), { zIndex: 1 }),
        '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),
        '&:hover ': {
            boxShadow: `${theme.shadows.z1}`,
            color: `${theme.colors.text.primary}`,
            background: `${theme.colors.background.secondary}`,
        },
    }),
});
//# sourceMappingURL=PanelHeaderNotice.js.map