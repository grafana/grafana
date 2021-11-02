import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { textUtil } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { Alert } from '../Alert/Alert';
import { useStyles, useTheme } from '../../themes/ThemeContext';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { List } from '../List/List';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { LogMessageAnsi } from './LogMessageAnsi';
var getLogRowContextStyles = function (theme, wrapLogMessage) {
    /**
     * This is workaround for displaying uncropped context when we have unwrapping log messages.
     * We are using margins to correctly position context. Because non-wrapped logs have always 1 line of log
     * and 1 line of Show/Hide context switch. Therefore correct position can be reliably achieved by margins.
     * We also adjust width to 75%.
     */
    var afterContext = wrapLogMessage
        ? css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        top: -250px;\n      "], ["\n        top: -250px;\n      "]))) : css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        margin-top: -250px;\n        width: 75%;\n      "], ["\n        margin-top: -250px;\n        width: 75%;\n      "])));
    var beforeContext = wrapLogMessage
        ? css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        top: 100%;\n      "], ["\n        top: 100%;\n      "]))) : css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        margin-top: 40px;\n        width: 75%;\n      "], ["\n        margin-top: 40px;\n        width: 75%;\n      "])));
    return {
        commonStyles: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      position: absolute;\n      height: 250px;\n      z-index: ", ";\n      overflow: hidden;\n      background: ", ";\n      box-shadow: 0 0 10px ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      width: 100%;\n    "], ["\n      position: absolute;\n      height: 250px;\n      z-index: ", ";\n      overflow: hidden;\n      background: ", ";\n      box-shadow: 0 0 10px ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n      width: 100%;\n    "])), theme.zIndex.dropdown, theme.colors.bg1, theme.colors.dropdownShadow, theme.colors.bg2, theme.border.radius.md),
        header: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      height: 30px;\n      padding: 0 10px;\n      display: flex;\n      align-items: center;\n      background: ", ";\n    "], ["\n      height: 30px;\n      padding: 0 10px;\n      display: flex;\n      align-items: center;\n      background: ", ";\n    "])), theme.colors.bg2),
        logs: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      height: 220px;\n      padding: 10px;\n    "], ["\n      height: 220px;\n      padding: 10px;\n    "]))),
        afterContext: afterContext,
        beforeContext: beforeContext,
    };
};
var LogRowContextGroupHeader = function (_a) {
    var row = _a.row, rows = _a.rows, onLoadMoreContext = _a.onLoadMoreContext, canLoadMoreRows = _a.canLoadMoreRows;
    var header = useStyles(getLogRowContextStyles).header;
    return (React.createElement("div", { className: header },
        React.createElement("span", { className: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n          opacity: 0.6;\n        "], ["\n          opacity: 0.6;\n        "]))) },
            "Found ",
            rows.length,
            " rows."),
        (rows.length >= 10 || (rows.length > 10 && rows.length % 10 !== 0)) && canLoadMoreRows && (React.createElement("span", { className: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n            margin-left: 10px;\n            &:hover {\n              text-decoration: underline;\n              cursor: pointer;\n            }\n          "], ["\n            margin-left: 10px;\n            &:hover {\n              text-decoration: underline;\n              cursor: pointer;\n            }\n          "]))), onClick: onLoadMoreContext }, "Load 10 more"))));
};
export var LogRowContextGroup = function (_a) {
    var row = _a.row, rows = _a.rows, error = _a.error, className = _a.className, shouldScrollToBottom = _a.shouldScrollToBottom, canLoadMoreRows = _a.canLoadMoreRows, onLoadMoreContext = _a.onLoadMoreContext;
    var _b = useStyles(getLogRowContextStyles), commonStyles = _b.commonStyles, logs = _b.logs;
    var _c = __read(useState(0), 2), scrollTop = _c[0], setScrollTop = _c[1];
    var listContainerRef = useRef();
    useLayoutEffect(function () {
        if (shouldScrollToBottom && listContainerRef.current) {
            setScrollTop(listContainerRef.current.offsetHeight);
        }
    }, [shouldScrollToBottom]);
    var headerProps = {
        row: row,
        rows: rows,
        onLoadMoreContext: onLoadMoreContext,
        canLoadMoreRows: canLoadMoreRows,
    };
    return (React.createElement("div", { className: cx(commonStyles, className) },
        shouldScrollToBottom && !error && React.createElement(LogRowContextGroupHeader, __assign({}, headerProps)),
        React.createElement("div", { className: logs },
            React.createElement(CustomScrollbar, { autoHide: true, scrollTop: scrollTop, autoHeightMin: '210px' },
                React.createElement("div", { ref: listContainerRef },
                    !error && (React.createElement(List, { items: rows, renderItem: function (item) {
                            return (React.createElement("div", { className: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n                        padding: 5px 0;\n                      "], ["\n                        padding: 5px 0;\n                      "]))) }, typeof item === 'string' && textUtil.hasAnsiCodes(item) ? React.createElement(LogMessageAnsi, { value: item }) : item));
                        } })),
                    error && React.createElement(Alert, { title: error })))),
        !shouldScrollToBottom && !error && React.createElement(LogRowContextGroupHeader, __assign({}, headerProps))));
};
export var LogRowContext = function (_a) {
    var row = _a.row, context = _a.context, errors = _a.errors, onOutsideClick = _a.onOutsideClick, onLoadMoreContext = _a.onLoadMoreContext, hasMoreContextRows = _a.hasMoreContextRows, wrapLogMessage = _a.wrapLogMessage;
    useEffect(function () {
        var handleEscKeyDown = function (e) {
            if (e.keyCode === 27) {
                onOutsideClick();
            }
        };
        document.addEventListener('keydown', handleEscKeyDown, false);
        return function () {
            document.removeEventListener('keydown', handleEscKeyDown, false);
        };
    }, [onOutsideClick]);
    var theme = useTheme();
    var _b = getLogRowContextStyles(theme, wrapLogMessage), afterContext = _b.afterContext, beforeContext = _b.beforeContext;
    return (React.createElement(ClickOutsideWrapper, { onClick: onOutsideClick },
        React.createElement("div", { onClick: function (e) { return e.stopPropagation(); } },
            context.after && (React.createElement(LogRowContextGroup, { rows: context.after, error: errors && errors.after, row: row, className: afterContext, shouldScrollToBottom: true, canLoadMoreRows: hasMoreContextRows ? hasMoreContextRows.after : false, onLoadMoreContext: onLoadMoreContext })),
            context.before && (React.createElement(LogRowContextGroup, { onLoadMoreContext: onLoadMoreContext, canLoadMoreRows: hasMoreContextRows ? hasMoreContextRows.before : false, row: row, rows: context.before, error: errors && errors.before, className: beforeContext })))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
//# sourceMappingURL=LogRowContext.js.map