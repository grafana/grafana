import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { Icon, renderOrCallToRender, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { useUpdateEffect } from 'react-use';
import { Draggable } from 'react-beautiful-dnd';
export var QueryOperationRow = function (_a) {
    var children = _a.children, actions = _a.actions, title = _a.title, headerElement = _a.headerElement, onClose = _a.onClose, onOpen = _a.onOpen, isOpen = _a.isOpen, disabled = _a.disabled, draggable = _a.draggable, index = _a.index, id = _a.id;
    var _b = __read(useState(isOpen !== undefined ? isOpen : true), 2), isContentVisible = _b[0], setIsContentVisible = _b[1];
    var theme = useTheme();
    var styles = getQueryOperationRowStyles(theme);
    var onRowToggle = useCallback(function () {
        setIsContentVisible(!isContentVisible);
    }, [isContentVisible, setIsContentVisible]);
    useUpdateEffect(function () {
        if (isContentVisible) {
            if (onOpen) {
                onOpen();
            }
        }
        else {
            if (onClose) {
                onClose();
            }
        }
    }, [isContentVisible]);
    var renderPropArgs = {
        isOpen: isContentVisible,
        onOpen: function () {
            setIsContentVisible(true);
        },
        onClose: function () {
            setIsContentVisible(false);
        },
    };
    var titleElement = title && renderOrCallToRender(title, renderPropArgs);
    var actionsElement = actions && renderOrCallToRender(actions, renderPropArgs);
    var headerElementRendered = headerElement && renderOrCallToRender(headerElement, renderPropArgs);
    var rowHeader = (React.createElement("div", { className: styles.header },
        React.createElement("div", { className: styles.column },
            React.createElement(Icon, { name: isContentVisible ? 'angle-down' : 'angle-right', className: styles.collapseIcon, onClick: onRowToggle }),
            title && (React.createElement("div", { className: styles.titleWrapper, onClick: onRowToggle, "aria-label": "Query operation row title" },
                React.createElement("div", { className: cx(styles.title, disabled && styles.disabled) }, titleElement))),
            headerElementRendered),
        React.createElement("div", { className: styles.column },
            actionsElement,
            draggable && (React.createElement(Icon, { title: "Drag and drop to reorder", name: "draggabledots", size: "lg", className: styles.dragIcon })))));
    if (draggable) {
        return (React.createElement(Draggable, { draggableId: id, index: index }, function (provided) {
            var dragHandleProps = __assign(__assign({}, provided.dragHandleProps), { role: 'group' }); // replace the role="button" because it causes https://dequeuniversity.com/rules/axe/4.3/nested-interactive?application=msftAI
            return (React.createElement(React.Fragment, null,
                React.createElement("div", __assign({ ref: provided.innerRef, className: styles.wrapper }, provided.draggableProps),
                    React.createElement("div", __assign({}, dragHandleProps), rowHeader),
                    isContentVisible && React.createElement("div", { className: styles.content }, children))));
        }));
    }
    return (React.createElement("div", { className: styles.wrapper },
        rowHeader,
        isContentVisible && React.createElement("div", { className: styles.content }, children)));
};
var getQueryOperationRowStyles = stylesFactory(function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.md),
        header: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: Header;\n      padding: ", " ", ";\n      border-radius: ", ";\n      background: ", ";\n      min-height: ", "px;\n      display: grid;\n      grid-template-columns: minmax(100px, max-content) min-content;\n      align-items: center;\n      justify-content: space-between;\n      white-space: nowrap;\n\n      &:focus {\n        outline: none;\n      }\n    "], ["\n      label: Header;\n      padding: ", " ", ";\n      border-radius: ", ";\n      background: ", ";\n      min-height: ", "px;\n      display: grid;\n      grid-template-columns: minmax(100px, max-content) min-content;\n      align-items: center;\n      justify-content: space-between;\n      white-space: nowrap;\n\n      &:focus {\n        outline: none;\n      }\n    "])), theme.spacing.xs, theme.spacing.sm, theme.border.radius.sm, theme.colors.bg2, theme.spacing.formInputHeight),
        column: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: Column;\n      display: flex;\n      align-items: center;\n    "], ["\n      label: Column;\n      display: flex;\n      align-items: center;\n    "]))),
        dragIcon: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      cursor: grab;\n      color: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      cursor: grab;\n      color: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.textWeak, theme.colors.text),
        collapseIcon: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      color: ", ";\n      cursor: pointer;\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      color: ", ";\n      cursor: pointer;\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.textWeak, theme.colors.text),
        titleWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      flex-grow: 1;\n      cursor: pointer;\n      overflow: hidden;\n      margin-right: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      flex-grow: 1;\n      cursor: pointer;\n      overflow: hidden;\n      margin-right: ", ";\n    "])), theme.spacing.sm),
        title: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-weight: ", ";\n      color: ", ";\n      margin-left: ", ";\n      overflow: hidden;\n      text-overflow: ellipsis;\n    "], ["\n      font-weight: ", ";\n      color: ", ";\n      margin-left: ", ";\n      overflow: hidden;\n      text-overflow: ellipsis;\n    "])), theme.typography.weight.semibold, theme.colors.textBlue, theme.spacing.sm),
        content: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      margin-top: ", ";\n      margin-left: ", ";\n    "], ["\n      margin-top: ", ";\n      margin-left: ", ";\n    "])), theme.spacing.inlineFormMargin, theme.spacing.lg),
        disabled: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.textWeak),
    };
});
QueryOperationRow.displayName = 'QueryOperationRow';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=QueryOperationRow.js.map