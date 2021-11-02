import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React, { memo, cloneElement } from 'react';
import { css, cx } from '@emotion/css';
import { useTheme2, stylesFactory } from '../../themes';
import { CardContainer } from './CardContainer';
/**
 * Generic card component
 *
 * @public
 */
export var Card = function (_a) {
    var heading = _a.heading, description = _a.description, disabled = _a.disabled, href = _a.href, onClick = _a.onClick, children = _a.children, htmlProps = __rest(_a, ["heading", "description", "disabled", "href", "onClick", "children"]);
    var theme = useTheme2();
    var styles = getCardStyles(theme);
    var _b = __read(['Tags', 'Figure', 'Meta', 'Actions', 'SecondaryActions'].map(function (item) {
        var found = React.Children.toArray(children).find(function (child) {
            return React.isValidElement(child) && (child === null || child === void 0 ? void 0 : child.type) && child.type.displayName === item;
        });
        if (found && React.isValidElement(found)) {
            return React.cloneElement(found, __assign({ disabled: disabled, styles: styles }, found.props));
        }
        return found;
    }), 5), tags = _b[0], figure = _b[1], meta = _b[2], actions = _b[3], secondaryActions = _b[4];
    var hasActions = Boolean(actions || secondaryActions);
    var disableHover = disabled || (!onClick && !href);
    var disableEvents = disabled && !actions;
    var onCardClick = onClick && !disabled ? onClick : undefined;
    var onEnterKey = onClick && !disabled ? getEnterKeyHandler(onClick) : undefined;
    return (React.createElement(CardContainer, __assign({ tabIndex: disableHover ? undefined : 0, onClick: onCardClick, onKeyDown: onEnterKey, disableEvents: disableEvents, disableHover: disableHover, href: href }, htmlProps),
        figure,
        React.createElement("div", { className: styles.inner },
            React.createElement("div", { className: styles.info },
                React.createElement("div", null,
                    React.createElement("h2", { className: styles.heading }, heading),
                    meta,
                    description && React.createElement("p", { className: styles.description }, description)),
                tags),
            hasActions && (React.createElement("div", { className: styles.actionRow },
                actions,
                secondaryActions)))));
};
function getEnterKeyHandler(onClick) {
    return function (e) {
        if (e.key === 'Enter') {
            onClick();
        }
    };
}
/**
 * @public
 */
export var getCardStyles = stylesFactory(function (theme) {
    return {
        inner: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n      flex-wrap: wrap;\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n      flex-wrap: wrap;\n    "]))),
        heading: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n      margin-bottom: 0;\n      font-size: ", ";\n      letter-spacing: inherit;\n      line-height: ", ";\n      color: ", ";\n      font-weight: ", ";\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n      margin-bottom: 0;\n      font-size: ", ";\n      letter-spacing: inherit;\n      line-height: ", ";\n      color: ", ";\n      font-weight: ", ";\n    "])), theme.typography.size.md, theme.typography.body.lineHeight, theme.colors.text.primary, theme.typography.fontWeightMedium),
        info: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n    "], ["\n      display: flex;\n      flex-direction: row;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n    "]))),
        metadata: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      width: 100%;\n      font-size: ", ";\n      color: ", ";\n      margin: ", ";\n      line-height: ", ";\n      overflow-wrap: anywhere;\n    "], ["\n      display: flex;\n      align-items: center;\n      width: 100%;\n      font-size: ", ";\n      color: ", ";\n      margin: ", ";\n      line-height: ", ";\n      overflow-wrap: anywhere;\n    "])), theme.typography.size.sm, theme.colors.text.secondary, theme.spacing(0.5, 0, 0), theme.typography.bodySmall.lineHeight),
        description: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      width: 100%;\n      margin: ", ";\n      color: ", ";\n      line-height: ", ";\n    "], ["\n      width: 100%;\n      margin: ", ";\n      color: ", ";\n      line-height: ", ";\n    "])), theme.spacing(1, 0, 0), theme.colors.text.secondary, theme.typography.body.lineHeight),
        media: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      margin-right: ", ";\n      width: 40px;\n\n      & > * {\n        width: 100%;\n      }\n\n      &:empty {\n        display: none;\n      }\n    "], ["\n      margin-right: ", ";\n      width: 40px;\n\n      & > * {\n        width: 100%;\n      }\n\n      &:empty {\n        display: none;\n      }\n    "])), theme.spacing(2)),
        actionRow: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n      margin-top: ", ";\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      width: 100%;\n      margin-top: ", ";\n    "])), theme.spacing(2)),
        actions: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      & > * {\n        margin-right: ", ";\n      }\n    "], ["\n      & > * {\n        margin-right: ", ";\n      }\n    "])), theme.spacing(1)),
        secondaryActions: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      color: ", ";\n      // align to the right\n      margin-left: auto;\n      & > * {\n        margin-right: ", " !important;\n      }\n    "], ["\n      display: flex;\n      align-items: center;\n      color: ", ";\n      // align to the right\n      margin-left: auto;\n      & > * {\n        margin-right: ", " !important;\n      }\n    "])), theme.colors.text.secondary, theme.spacing(1)),
        separator: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      margin: 0 ", ";\n    "], ["\n      margin: 0 ", ";\n    "])), theme.spacing(1)),
        tagList: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      max-width: 50%;\n    "], ["\n      max-width: 50%;\n    "]))),
    };
});
var Tags = function (_a) {
    var children = _a.children, styles = _a.styles;
    return React.createElement("div", { className: styles === null || styles === void 0 ? void 0 : styles.tagList }, children);
};
Tags.displayName = 'Tags';
var Figure = function (_a) {
    var children = _a.children, styles = _a.styles, _b = _a.align, align = _b === void 0 ? 'top' : _b, className = _a.className;
    return (React.createElement("div", { className: cx(styles === null || styles === void 0 ? void 0 : styles.media, className, align === 'center' && css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n            display: flex;\n            align-items: center;\n          "], ["\n            display: flex;\n            align-items: center;\n          "])))) }, children));
};
Figure.displayName = 'Figure';
var Meta = memo(function (_a) {
    var children = _a.children, styles = _a.styles, _b = _a.separator, separator = _b === void 0 ? '|' : _b;
    var meta = children;
    // Join meta data elements by separator
    if (Array.isArray(children) && separator) {
        var filtered = React.Children.toArray(children).filter(Boolean);
        if (!filtered.length) {
            return null;
        }
        meta = filtered.reduce(function (prev, curr, i) { return [
            prev,
            React.createElement("span", { key: "separator_" + i, className: styles === null || styles === void 0 ? void 0 : styles.separator }, separator),
            curr,
        ]; });
    }
    return React.createElement("div", { className: styles === null || styles === void 0 ? void 0 : styles.metadata }, meta);
});
Meta.displayName = 'Meta';
var BaseActions = function (_a) {
    var children = _a.children, styles = _a.styles, disabled = _a.disabled, variant = _a.variant;
    var css = variant === 'primary' ? styles === null || styles === void 0 ? void 0 : styles.actions : styles === null || styles === void 0 ? void 0 : styles.secondaryActions;
    return (React.createElement("div", { className: css }, React.Children.map(children, function (child) {
        return React.isValidElement(child) ? cloneElement(child, __assign({ disabled: disabled }, child.props)) : null;
    })));
};
var Actions = function (_a) {
    var children = _a.children, styles = _a.styles, disabled = _a.disabled;
    return (React.createElement(BaseActions, { variant: "primary", disabled: disabled, styles: styles }, children));
};
Actions.displayName = 'Actions';
var SecondaryActions = function (_a) {
    var children = _a.children, styles = _a.styles, disabled = _a.disabled;
    return (React.createElement(BaseActions, { variant: "secondary", disabled: disabled, styles: styles }, children));
};
SecondaryActions.displayName = 'SecondaryActions';
Card.Tags = Tags;
Card.Figure = Figure;
Card.Meta = Meta;
Card.Actions = Actions;
Card.SecondaryActions = SecondaryActions;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12;
//# sourceMappingURL=Card.js.map