import { __rest } from "tslib";
import { cx, css } from '@emotion/css';
import React from 'react';
import { isIconName } from '@grafana/data';
import { Icon, useStyles2, Tooltip } from '@grafana/ui';
export function ContentOutlineItemButton(_a) {
    var { title, icon, tooltip, className } = _a, rest = __rest(_a, ["title", "icon", "tooltip", "className"]);
    const styles = useStyles2(getStyles);
    const buttonStyles = cx(styles.button, className);
    const body = (React.createElement("button", Object.assign({ className: buttonStyles, "aria-label": tooltip }, rest),
        renderIcon(icon),
        title));
    return tooltip ? (React.createElement(Tooltip, { content: tooltip, placement: "bottom" }, body)) : (body);
}
function renderIcon(icon) {
    if (!icon) {
        return null;
    }
    if (isIconName(icon)) {
        return React.createElement(Icon, { name: icon, size: 'lg' });
    }
    return icon;
}
const getStyles = (theme) => {
    return {
        button: css({
            label: 'content-outline-item-button',
            display: 'flex',
            flexGrow: 1,
            alignItems: 'center',
            height: theme.spacing(theme.components.height.md),
            padding: theme.spacing(0, 1),
            gap: theme.spacing(1),
            color: theme.colors.text.secondary,
            background: 'transparent',
            border: 'none',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            '&:hover': {
                color: theme.colors.text.primary,
                background: theme.colors.background.secondary,
                textDecoration: 'underline',
            },
        }),
    };
};
//# sourceMappingURL=ContentOutlineItemButton.js.map