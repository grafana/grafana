import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { styleMixins } from '../../themes';
import { IconButton } from '../IconButton/IconButton';
import { selectors } from '@grafana/e2e-selectors';
import { Link } from '..';
import { getFocusStyles } from '../../themes/mixins';
/** @alpha */
export var PageToolbar = React.memo(function (_a) {
    var _b;
    var title = _a.title, parent = _a.parent, pageIcon = _a.pageIcon, onGoBack = _a.onGoBack, children = _a.children, titleHref = _a.titleHref, parentHref = _a.parentHref, leftItems = _a.leftItems, isFullscreen = _a.isFullscreen, className = _a.className;
    var styles = useStyles2(getStyles);
    /**
     * .page-toolbar css class is used for some legacy css view modes (TV/Kiosk) and
     * media queries for mobile view when toolbar needs left padding to make room
     * for mobile menu icon. This logic hopefylly can be changed when we move to a full react
     * app and change how the app side menu & mobile menu is rendered.
     */
    var mainStyle = cx('page-toolbar', styles.toolbar, (_b = {},
        _b['page-toolbar--fullscreen'] = isFullscreen,
        _b), className);
    return (React.createElement("div", { className: mainStyle },
        pageIcon && !onGoBack && (React.createElement("div", { className: styles.pageIcon },
            React.createElement(Icon, { name: pageIcon, size: "lg", "aria-hidden": true }))),
        onGoBack && (React.createElement("div", { className: styles.pageIcon },
            React.createElement(IconButton, { name: "arrow-left", tooltip: "Go back (Esc)", tooltipPlacement: "bottom", size: "xxl", surface: "dashboard", "aria-label": selectors.components.BackButton.backArrow, onClick: onGoBack }))),
        React.createElement("nav", { "aria-label": "Search links", className: styles.navElement },
            parent && parentHref && (React.createElement(React.Fragment, null,
                React.createElement(Link, { "aria-label": "Search dashboard in the " + parent + " folder", className: cx(styles.titleText, styles.parentLink, styles.titleLink), href: parentHref },
                    parent,
                    " ",
                    React.createElement("span", { className: styles.parentIcon })),
                titleHref && (React.createElement("span", { className: cx(styles.titleText, styles.titleDivider, styles.parentLink), "aria-hidden": true }, "/")))),
            titleHref && (React.createElement("h1", { className: styles.h1Styles },
                React.createElement(Link, { "aria-label": "Search dashboard by name", className: cx(styles.titleText, styles.titleLink), href: titleHref }, title))),
            !titleHref && React.createElement("h1", { className: styles.titleText }, title)), leftItems === null || leftItems === void 0 ? void 0 :
        leftItems.map(function (child, index) { return (React.createElement("div", { className: styles.leftActionItem, key: index }, child)); }),
        React.createElement("div", { className: styles.spacer }),
        React.Children.toArray(children)
            .filter(Boolean)
            .map(function (child, index) {
            return (React.createElement("div", { className: styles.actionWrapper, key: index }, child));
        })));
});
PageToolbar.displayName = 'PageToolbar';
var getStyles = function (theme) {
    var spacing = theme.spacing, typography = theme.typography;
    var focusStyle = getFocusStyles(theme);
    var titleStyles = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-size: ", ";\n    white-space: nowrap;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    margin: 0;\n    max-width: 240px;\n    border-radius: 2px;\n\n    @media ", " {\n      max-width: unset;\n    }\n  "], ["\n    font-size: ", ";\n    white-space: nowrap;\n    text-overflow: ellipsis;\n    overflow: hidden;\n    margin: 0;\n    max-width: 240px;\n    border-radius: 2px;\n\n    @media ", " {\n      max-width: unset;\n    }\n  "])), typography.size.lg, styleMixins.mediaUp(theme.v1.breakpoints.xl));
    return {
        toolbar: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      align-items: center;\n      background: ", ";\n      display: flex;\n      flex-wrap: wrap;\n      justify-content: flex-end;\n      padding: ", ";\n    "], ["\n      align-items: center;\n      background: ", ";\n      display: flex;\n      flex-wrap: wrap;\n      justify-content: flex-end;\n      padding: ", ";\n    "])), theme.colors.background.canvas, theme.spacing(1.5, 2)),
        spacer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      flex-grow: 1;\n    "], ["\n      flex-grow: 1;\n    "]))),
        pageIcon: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: none;\n      @media ", " {\n        display: flex;\n        padding-right: ", ";\n        align-items: center;\n      }\n    "], ["\n      display: none;\n      @media ", " {\n        display: flex;\n        padding-right: ", ";\n        align-items: center;\n      }\n    "])), styleMixins.mediaUp(theme.v1.breakpoints.md), theme.spacing(1)),
        titleWrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      min-width: 0;\n      overflow: hidden;\n    "], ["\n      display: flex;\n      align-items: center;\n      min-width: 0;\n      overflow: hidden;\n    "]))),
        navElement: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        h1Styles: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      margin: 0;\n      line-height: inherit;\n      display: flex;\n    "], ["\n      margin: 0;\n      line-height: inherit;\n      display: flex;\n    "]))),
        parentIcon: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(0.5)),
        titleText: titleStyles,
        titleLink: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      &:focus-visible {\n        ", "\n      }\n    "], ["\n      &:focus-visible {\n        ", "\n      }\n    "])), focusStyle),
        titleDivider: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), spacing(0, 0.5, 0, 0.5)),
        parentLink: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      display: none;\n      @media ", " {\n        display: unset;\n      }\n    "], ["\n      display: none;\n      @media ", " {\n        display: unset;\n      }\n    "])), styleMixins.mediaUp(theme.v1.breakpoints.md)),
        actionWrapper: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n      padding: ", ";\n    "], ["\n      padding: ", ";\n    "])), spacing(0.5, 0, 0.5, 1)),
        leftActionItem: css(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n      display: none;\n      @media ", " {\n        align-items: center;\n        display: flex;\n        padding-left: ", ";\n      }\n    "], ["\n      display: none;\n      @media ", " {\n        align-items: center;\n        display: flex;\n        padding-left: ", ";\n      }\n    "])), styleMixins.mediaUp(theme.v1.breakpoints.md), spacing(0.5)),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13;
//# sourceMappingURL=PageToolbar.js.map