import { __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useState } from 'react';
import { css, cx } from '@emotion/css';
import { IconButton, useStyles2 } from '@grafana/ui';
export var DynamicTable = function (_a) {
    var cols = _a.cols, items = _a.items, _b = _a.isExpandable, isExpandable = _b === void 0 ? false : _b, onCollapse = _a.onCollapse, onExpand = _a.onExpand, isExpanded = _a.isExpanded, renderExpandedContent = _a.renderExpandedContent, testIdGenerator = _a.testIdGenerator, 
    // render a cell BEFORE expand icon for header/ each row.
    // currently use by RuleList to render guidelines
    renderPrefixCell = _a.renderPrefixCell, renderPrefixHeader = _a.renderPrefixHeader;
    if ((onCollapse || onExpand || isExpanded) && !(onCollapse && onExpand && isExpanded)) {
        throw new Error('either all of onCollapse, onExpand, isExpanded must be provided, or none');
    }
    if ((isExpandable || renderExpandedContent) && !(isExpandable && renderExpandedContent)) {
        throw new Error('either both isExpanded and renderExpandedContent must be provided, or neither');
    }
    var styles = useStyles2(getStyles(cols, isExpandable, !!renderPrefixHeader));
    var _c = __read(useState([]), 2), expandedIds = _c[0], setExpandedIds = _c[1];
    var toggleExpanded = function (item) {
        if (isExpanded && onCollapse && onExpand) {
            isExpanded(item) ? onCollapse(item) : onExpand(item);
        }
        else {
            setExpandedIds(expandedIds.includes(item.id) ? expandedIds.filter(function (itemId) { return itemId !== item.id; }) : __spreadArray(__spreadArray([], __read(expandedIds), false), [item.id], false));
        }
    };
    return (React.createElement("div", { className: styles.container, "data-testid": "dynamic-table" },
        React.createElement("div", { className: styles.row, "data-testid": "header" },
            renderPrefixHeader && renderPrefixHeader(),
            isExpandable && React.createElement("div", { className: styles.cell }),
            cols.map(function (col) { return (React.createElement("div", { className: styles.cell, key: col.id }, col.label)); })),
        items.map(function (item, index) {
            var _a;
            var isItemExpanded = isExpanded ? isExpanded(item) : expandedIds.includes(item.id);
            return (React.createElement("div", { className: styles.row, key: item.id, "data-testid": (_a = testIdGenerator === null || testIdGenerator === void 0 ? void 0 : testIdGenerator(item, index)) !== null && _a !== void 0 ? _a : 'row' },
                renderPrefixCell && renderPrefixCell(item, index, items),
                isExpandable && (React.createElement("div", { className: cx(styles.cell, styles.expandCell) },
                    React.createElement(IconButton, { size: "xl", "data-testid": "collapse-toggle", className: styles.expandButton, name: isItemExpanded ? 'angle-down' : 'angle-right', onClick: function () { return toggleExpanded(item); }, type: "button" }))),
                cols.map(function (col) { return (React.createElement("div", { className: cx(styles.cell, styles.bodyCell), "data-column": col.label, key: item.id + "-" + col.id }, col.renderCell(item, index))); }),
                isItemExpanded && renderExpandedContent && (React.createElement("div", { className: styles.expandedContentRow, "data-testid": "expanded-content" }, renderExpandedContent(item, index, items)))));
        })));
};
var getStyles = function (cols, isExpandable, hasPrefixCell) {
    var sizes = cols.map(function (col) {
        if (!col.size) {
            return 'auto';
        }
        if (typeof col.size === 'number') {
            return col.size + "fr";
        }
        return col.size;
    });
    if (isExpandable) {
        sizes.unshift('calc(1em + 16px)');
    }
    if (hasPrefixCell) {
        sizes.unshift('0');
    }
    return function (theme) { return ({
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border: 1px solid ", ";\n      border-radius: 2px;\n      color: ", ";\n    "], ["\n      border: 1px solid ", ";\n      border-radius: 2px;\n      color: ", ";\n    "])), theme.colors.border.strong, theme.colors.text.secondary),
        row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: grid;\n      grid-template-columns: ", ";\n      grid-template-rows: 1fr auto;\n\n      &:nth-child(2n + 1) {\n        background-color: ", ";\n      }\n\n      &:nth-child(2n) {\n        background-color: ", ";\n      }\n\n      ", " {\n        grid-template-columns: auto 1fr;\n        grid-template-areas: 'left right';\n        padding: 0 ", ";\n\n        &:first-child {\n          display: none;\n        }\n\n        ", "\n      }\n    "], ["\n      display: grid;\n      grid-template-columns: ", ";\n      grid-template-rows: 1fr auto;\n\n      &:nth-child(2n + 1) {\n        background-color: ", ";\n      }\n\n      &:nth-child(2n) {\n        background-color: ", ";\n      }\n\n      ", " {\n        grid-template-columns: auto 1fr;\n        grid-template-areas: 'left right';\n        padding: 0 ", ";\n\n        &:first-child {\n          display: none;\n        }\n\n        ", "\n      }\n    "])), sizes.join(' '), theme.colors.background.secondary, theme.colors.background.primary, theme.breakpoints.down('sm'), theme.spacing(0.5), hasPrefixCell
            ? "\n            & > *:first-child {\n              display: none;\n            }\n          "
            : ''),
        cell: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      align-items: center;\n      padding: ", ";\n\n      ", " {\n        padding: ", " 0;\n        grid-template-columns: 1fr;\n      }\n    "], ["\n      align-items: center;\n      padding: ", ";\n\n      ", " {\n        padding: ", " 0;\n        grid-template-columns: 1fr;\n      }\n    "])), theme.spacing(1), theme.breakpoints.down('sm'), theme.spacing(1)),
        bodyCell: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      overflow: hidden;\n      word-break: break-all;\n      ", " {\n        grid-column-end: right;\n        grid-column-start: right;\n\n        &::before {\n          content: attr(data-column);\n          display: block;\n          color: ", ";\n        }\n      }\n    "], ["\n      overflow: hidden;\n      word-break: break-all;\n      ", " {\n        grid-column-end: right;\n        grid-column-start: right;\n\n        &::before {\n          content: attr(data-column);\n          display: block;\n          color: ", ";\n        }\n      }\n    "])), theme.breakpoints.down('sm'), theme.colors.text.primary),
        expandCell: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      justify-content: center;\n\n      ", " {\n        align-items: start;\n        grid-area: left;\n      }\n    "], ["\n      justify-content: center;\n\n      ", " {\n        align-items: start;\n        grid-area: left;\n      }\n    "])), theme.breakpoints.down('sm')),
        expandedContentRow: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      grid-column-end: ", ";\n      grid-column-start: ", ";\n      grid-row: 2;\n      padding: 0 ", " 0 ", ";\n      position: relative;\n\n      ", " {\n        grid-column-start: 2;\n        border-top: 1px solid ", ";\n        grid-row: auto;\n        padding: ", " 0 0 0;\n      }\n    "], ["\n      grid-column-end: ", ";\n      grid-column-start: ", ";\n      grid-row: 2;\n      padding: 0 ", " 0 ", ";\n      position: relative;\n\n      ", " {\n        grid-column-start: 2;\n        border-top: 1px solid ", ";\n        grid-row: auto;\n        padding: ", " 0 0 0;\n      }\n    "])), sizes.length + 1, hasPrefixCell ? 3 : 2, theme.spacing(3), theme.spacing(1), theme.breakpoints.down('sm'), theme.colors.border.strong, theme.spacing(1)),
        expandButton: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      margin-right: 0;\n      display: block;\n    "], ["\n      margin-right: 0;\n      display: block;\n    "]))),
    }); };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=DynamicTable.js.map