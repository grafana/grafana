import { __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { Icon } from '..';
export var CollapsableSection = function (_a) {
    var label = _a.label, isOpen = _a.isOpen, children = _a.children;
    var _b = __read(useState(isOpen), 2), open = _b[0], toggleOpen = _b[1];
    var styles = useStyles2(collapsableSectionStyles);
    var headerStyle = open ? styles.header : styles.headerCollapsed;
    var tooltip = "Click to " + (open ? 'collapse' : 'expand');
    return (React.createElement("div", null,
        React.createElement("div", { onClick: function () { return toggleOpen(!open); }, className: headerStyle, title: tooltip },
            label,
            React.createElement(Icon, { name: open ? 'angle-down' : 'angle-right', size: "xl", className: styles.icon })),
        open && React.createElement("div", { className: styles.content }, children)));
};
var collapsableSectionStyles = function (theme) {
    var header = css({
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: theme.typography.size.lg,
        padding: theme.spacing(0.5) + " 0",
        cursor: 'pointer',
    });
    var headerCollapsed = css(header, {
        borderBottom: "1px solid " + theme.colors.border.weak,
    });
    var icon = css({
        color: theme.colors.text.secondary,
    });
    var content = css({
        padding: theme.spacing(2) + " 0",
    });
    return { header: header, headerCollapsed: headerCollapsed, icon: icon, content: content };
};
//# sourceMappingURL=CollapsableSection.js.map