import { __makeTemplateObject } from "tslib";
import React from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { css, cx } from '@emotion/css';
import { CompletionItemKind } from '../../types/completion';
import { PartialHighlighter } from './PartialHighlighter';
import { useStyles } from '../../themes/ThemeContext';
var getStyles = function (theme) { return ({
    typeaheadItem: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: type-ahead-item;\n    height: auto;\n    font-family: ", ";\n    padding: ", " ", " ", " ", ";\n    font-size: ", ";\n    text-overflow: ellipsis;\n    overflow: hidden;\n    z-index: 11;\n    display: block;\n    white-space: nowrap;\n    cursor: pointer;\n    transition: color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1),\n      background 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), padding 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);\n  "], ["\n    label: type-ahead-item;\n    height: auto;\n    font-family: ", ";\n    padding: ", " ", " ", " ", ";\n    font-size: ", ";\n    text-overflow: ellipsis;\n    overflow: hidden;\n    z-index: 11;\n    display: block;\n    white-space: nowrap;\n    cursor: pointer;\n    transition: color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), border-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1),\n      background 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), padding 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);\n  "])), theme.typography.fontFamily.monospace, theme.spacing.sm, theme.spacing.sm, theme.spacing.sm, theme.spacing.md, theme.typography.size.sm),
    typeaheadItemSelected: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: type-ahead-item-selected;\n    background-color: ", ";\n  "], ["\n    label: type-ahead-item-selected;\n    background-color: ", ";\n  "])), theme.colors.bg2),
    typeaheadItemMatch: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: type-ahead-item-match;\n    color: ", ";\n    border-bottom: 1px solid ", ";\n    padding: inherit;\n    background: inherit;\n  "], ["\n    label: type-ahead-item-match;\n    color: ", ";\n    border-bottom: 1px solid ", ";\n    padding: inherit;\n    background: inherit;\n  "])), theme.palette.yellow, theme.palette.yellow),
    typeaheadItemGroupTitle: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    label: type-ahead-item-group-title;\n    color: ", ";\n    font-size: ", ";\n    line-height: ", ";\n    padding: ", ";\n  "], ["\n    label: type-ahead-item-group-title;\n    color: ", ";\n    font-size: ", ";\n    line-height: ", ";\n    padding: ", ";\n  "])), theme.colors.textWeak, theme.typography.size.sm, theme.typography.lineHeight.md, theme.spacing.sm),
}); };
export var TypeaheadItem = function (props) {
    var styles = useStyles(getStyles);
    var isSelected = props.isSelected, item = props.item, prefix = props.prefix, style = props.style, onMouseEnter = props.onMouseEnter, onMouseLeave = props.onMouseLeave, onClickItem = props.onClickItem;
    var className = isSelected ? cx([styles.typeaheadItem, styles.typeaheadItemSelected]) : cx([styles.typeaheadItem]);
    var highlightClassName = cx([styles.typeaheadItemMatch]);
    var itemGroupTitleClassName = cx([styles.typeaheadItemGroupTitle]);
    var label = item.label || '';
    if (item.kind === CompletionItemKind.GroupTitle) {
        return (React.createElement("li", { className: itemGroupTitleClassName, style: style },
            React.createElement("span", null, label)));
    }
    return (React.createElement("li", { className: className, style: style, onMouseDown: onClickItem, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave }, item.highlightParts !== undefined ? (React.createElement(PartialHighlighter, { text: label, highlightClassName: highlightClassName, highlightParts: item.highlightParts })) : (React.createElement(Highlighter, { textToHighlight: label, searchWords: [prefix !== null && prefix !== void 0 ? prefix : ''], highlightClassName: highlightClassName }))));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=TypeaheadItem.js.map