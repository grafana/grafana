import { __assign, __makeTemplateObject } from "tslib";
import { Button, Input, Popover, PopoverController, stylesFactory, Tooltip as GrafanaTooltip, useTheme, } from '@grafana/ui';
import cx from 'classnames';
import { css } from '@emotion/css';
import React, { useRef } from 'react';
/**
 * Right now Jaeger components need some UI elements to be injected. This is to get rid of AntD UI library that was
 * used by default.
 */
// This needs to be static to prevent remounting on every render.
export var UIElements = {
    Popover: function (_a) {
        var children = _a.children, content = _a.content, overlayClassName = _a.overlayClassName;
        var popoverRef = useRef(null);
        return (React.createElement(PopoverController, { content: content, hideAfter: 300 }, function (showPopper, hidePopper, popperProps) {
            return (React.createElement(React.Fragment, null,
                popoverRef.current && (React.createElement(Popover, __assign({}, popperProps, { referenceElement: popoverRef.current, wrapperClassName: overlayClassName, onMouseLeave: hidePopper, onMouseEnter: showPopper }))),
                React.cloneElement(children, {
                    ref: popoverRef,
                    onMouseEnter: showPopper,
                    onMouseLeave: hidePopper,
                })));
        }));
    },
    Tooltip: function (_a) {
        var children = _a.children, title = _a.title;
        return React.createElement(GrafanaTooltip, { content: title }, children);
    },
    Icon: (function () { return null; }),
    Dropdown: (function () { return null; }),
    Menu: (function () { return null; }),
    MenuItem: (function () { return null; }),
    Button: function (_a) {
        var onClick = _a.onClick, children = _a.children, className = _a.className;
        return (React.createElement(Button, { variant: "secondary", onClick: onClick, className: className }, children));
    },
    Divider: Divider,
    Input: function (props) {
        return React.createElement(Input, __assign({}, props));
    },
    InputGroup: function (_a) {
        var children = _a.children, className = _a.className, style = _a.style;
        return (React.createElement("span", { className: className, style: style }, children));
    },
};
var getStyles = stylesFactory(function (theme) {
    return {
        Divider: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: inline-block;\n      background: ", ";\n      width: 1px;\n      height: 0.9em;\n      margin: 0 8px;\n      vertical-align: middle;\n    "], ["\n      display: inline-block;\n      background: ", ";\n      width: 1px;\n      height: 0.9em;\n      margin: 0 8px;\n      vertical-align: middle;\n    "])), theme.isDark ? '#242424' : '#e8e8e8'),
    };
});
function Divider(_a) {
    var className = _a.className;
    var styles = getStyles(useTheme());
    return React.createElement("div", { style: {}, className: cx(styles.Divider, className) });
}
var templateObject_1;
//# sourceMappingURL=uiElements.js.map