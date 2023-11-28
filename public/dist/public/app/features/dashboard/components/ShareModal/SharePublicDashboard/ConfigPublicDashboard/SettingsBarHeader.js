import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { IconButton, ReactUtils, useStyles2 } from '@grafana/ui';
export function SettingsBarHeader(_a) {
    var { headerElement, isContentVisible = false, onRowToggle, title } = _a, rest = __rest(_a, ["headerElement", "isContentVisible", "onRowToggle", "title"]);
    const styles = useStyles2(getStyles);
    const headerElementRendered = headerElement && ReactUtils.renderOrCallToRender(headerElement, { className: styles.summaryWrapper });
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.header },
            React.createElement(IconButton, Object.assign({ name: isContentVisible ? 'angle-down' : 'angle-right', tooltip: isContentVisible ? 'Collapse settings' : 'Expand settings', className: styles.collapseIcon, onClick: onRowToggle, "aria-expanded": isContentVisible }, rest)),
            title && (
            // disabling the a11y rules here as the IconButton above handles keyboard interactions
            // this is just to provide a better experience for mouse users
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            React.createElement("div", { className: styles.titleWrapper, onClick: onRowToggle },
                React.createElement("span", { className: styles.title }, title))),
            headerElementRendered)));
}
SettingsBarHeader.displayName = 'SettingsBarHeader';
function getStyles(theme) {
    return {
        wrapper: css({
            label: 'header',
            padding: theme.spacing(0.5, 0.5),
            borderRadius: theme.shape.radius.default,
            background: theme.colors.background.secondary,
            minHeight: theme.spacing(4),
            '&:focus': {
                outline: 'none',
            },
        }),
        header: css({
            label: 'column',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
        }),
        collapseIcon: css({
            marginLeft: theme.spacing(0.5),
            color: theme.colors.text.disabled,
        }),
        titleWrapper: css({
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            marginRight: `${theme.spacing(0.5)}`,
            [theme.breakpoints.down('sm')]: {
                flex: '1 1',
            },
        }),
        title: css({
            fontWeight: theme.typography.fontWeightBold,
            marginLeft: theme.spacing(0.5),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        }),
        summaryWrapper: css({
            display: 'flex',
            flexWrap: 'wrap',
            [theme.breakpoints.down('sm')]: {
                flex: '2 2',
            },
        }),
    };
}
//# sourceMappingURL=SettingsBarHeader.js.map