import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
var getStyles = function (theme) { return ({
    collapse: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: collapse;\n    margin-bottom: ", ";\n  "], ["\n    label: collapse;\n    margin-bottom: ", ";\n  "])), theme.spacing(1)),
    collapseBody: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: collapse__body;\n    padding: ", ";\n    padding-top: 0;\n    flex: 1;\n    overflow: hidden;\n    display: flex;\n    flex-direction: column;\n  "], ["\n    label: collapse__body;\n    padding: ", ";\n    padding-top: 0;\n    flex: 1;\n    overflow: hidden;\n    display: flex;\n    flex-direction: column;\n  "])), theme.spacing(theme.components.panel.padding)),
    bodyContentWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: bodyContentWrapper;\n    flex: 1;\n    overflow: hidden;\n  "], ["\n    label: bodyContentWrapper;\n    flex: 1;\n    overflow: hidden;\n  "]))),
    loader: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    label: collapse__loader;\n    height: 2px;\n    position: relative;\n    overflow: hidden;\n    background: none;\n    margin: ", ";\n  "], ["\n    label: collapse__loader;\n    height: 2px;\n    position: relative;\n    overflow: hidden;\n    background: none;\n    margin: ", ";\n  "])), theme.spacing(0.5)),
    loaderActive: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    label: collapse__loader_active;\n    &:after {\n      content: ' ';\n      display: block;\n      width: 25%;\n      top: 0;\n      top: -50%;\n      height: 250%;\n      position: absolute;\n      animation: loader 2s cubic-bezier(0.17, 0.67, 0.83, 0.67) 500ms;\n      animation-iteration-count: 100;\n      left: -25%;\n      background: ", ";\n    }\n    @keyframes loader {\n      from {\n        left: -25%;\n        opacity: 0.1;\n      }\n      to {\n        left: 100%;\n        opacity: 1;\n      }\n    }\n  "], ["\n    label: collapse__loader_active;\n    &:after {\n      content: ' ';\n      display: block;\n      width: 25%;\n      top: 0;\n      top: -50%;\n      height: 250%;\n      position: absolute;\n      animation: loader 2s cubic-bezier(0.17, 0.67, 0.83, 0.67) 500ms;\n      animation-iteration-count: 100;\n      left: -25%;\n      background: ", ";\n    }\n    @keyframes loader {\n      from {\n        left: -25%;\n        opacity: 0.1;\n      }\n      to {\n        left: 100%;\n        opacity: 1;\n      }\n    }\n  "])), theme.colors.primary.main),
    header: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    label: collapse__header;\n    padding: ", ";\n    display: flex;\n    cursor: inherit;\n    transition: all 0.1s linear;\n    cursor: pointer;\n  "], ["\n    label: collapse__header;\n    padding: ", ";\n    display: flex;\n    cursor: inherit;\n    transition: all 0.1s linear;\n    cursor: pointer;\n  "])), theme.spacing(1, 2, 0.5, 2)),
    headerCollapsed: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    label: collapse__header--collapsed;\n    padding: ", ";\n  "], ["\n    label: collapse__header--collapsed;\n    padding: ", ";\n  "])), theme.spacing(1, 2, 0.5, 2)),
    headerLabel: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    label: collapse__header-label;\n    font-weight: ", ";\n    margin-right: ", ";\n    font-size: ", ";\n  "], ["\n    label: collapse__header-label;\n    font-weight: ", ";\n    margin-right: ", ";\n    font-size: ", ";\n  "])), theme.typography.fontWeightMedium, theme.spacing(1), theme.typography.size.md),
    icon: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    label: collapse__icon;\n    margin: ", ";\n  "], ["\n    label: collapse__icon;\n    margin: ", ";\n  "])), theme.spacing(0, 1, 0, -1)),
}); };
export var ControlledCollapse = function (_a) {
    var isOpen = _a.isOpen, onToggle = _a.onToggle, otherProps = __rest(_a, ["isOpen", "onToggle"]);
    var _b = __read(useState(isOpen), 2), open = _b[0], setOpen = _b[1];
    return (React.createElement(Collapse, __assign({ isOpen: open, collapsible: true }, otherProps, { onToggle: function () {
            setOpen(!open);
            if (onToggle) {
                onToggle(!open);
            }
        } })));
};
export var Collapse = function (_a) {
    var isOpen = _a.isOpen, label = _a.label, loading = _a.loading, collapsible = _a.collapsible, onToggle = _a.onToggle, className = _a.className, children = _a.children;
    var style = useStyles2(getStyles);
    var onClickToggle = function () {
        if (onToggle) {
            onToggle(!isOpen);
        }
    };
    var panelClass = cx([style.collapse, 'panel-container', className]);
    var loaderClass = loading ? cx([style.loader, style.loaderActive]) : cx([style.loader]);
    var headerClass = collapsible ? cx([style.header]) : cx([style.headerCollapsed]);
    return (React.createElement("div", { className: panelClass },
        React.createElement("div", { className: headerClass, onClick: onClickToggle },
            collapsible && React.createElement(Icon, { className: style.icon, name: isOpen ? 'angle-up' : 'angle-down' }),
            React.createElement("div", { className: cx([style.headerLabel]) }, label)),
        isOpen && (React.createElement("div", { className: cx([style.collapseBody]) },
            React.createElement("div", { className: loaderClass }),
            React.createElement("div", { className: style.bodyContentWrapper }, children)))));
};
Collapse.displayName = 'Collapse';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=Collapse.js.map