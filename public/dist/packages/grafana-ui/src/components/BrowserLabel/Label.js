import { __assign, __makeTemplateObject, __rest } from "tslib";
import React, { forwardRef, useCallback } from 'react';
import { cx, css } from '@emotion/css';
import { useTheme2 } from '../../themes';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { PartialHighlighter } from '../Typeahead/PartialHighlighter';
/**
 * @internal
 */
export var Label = forwardRef(function (_a, ref) {
    var name = _a.name, value = _a.value, hidden = _a.hidden, facets = _a.facets, onClick = _a.onClick, className = _a.className, loading = _a.loading, searchTerm = _a.searchTerm, active = _a.active, style = _a.style, title = _a.title, highlightParts = _a.highlightParts, rest = __rest(_a, ["name", "value", "hidden", "facets", "onClick", "className", "loading", "searchTerm", "active", "style", "title", "highlightParts"]);
    var theme = useTheme2();
    var styles = getLabelStyles(theme);
    var searchWords = searchTerm ? [searchTerm] : [];
    var onLabelClick = useCallback(function (event) {
        if (onClick && !hidden) {
            onClick(name, value, event);
        }
    }, [onClick, name, hidden, value]);
    // Using this component for labels and label values. If value is given use value for display text.
    var text = value || name;
    if (facets) {
        text = text + " (" + facets + ")";
    }
    return (React.createElement("span", __assign({ key: text, ref: ref, onClick: onLabelClick, style: style, title: title || text, role: "option", "aria-selected": !!active, className: cx(styles.base, active && styles.active, loading && styles.loading, hidden && styles.hidden, className, onClick && !hidden && styles.hover) }, rest), highlightParts !== undefined ? (React.createElement(PartialHighlighter, { text: text, highlightClassName: styles.matchHighLight, highlightParts: highlightParts })) : (React.createElement(Highlighter, { textToHighlight: text, searchWords: searchWords, autoEscape: true, highlightClassName: styles.matchHighLight }))));
});
Label.displayName = 'Label';
var getLabelStyles = function (theme) { return ({
    base: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: inline-block;\n    cursor: pointer;\n    font-size: ", ";\n    line-height: ", ";\n    background-color: ", ";\n    color: ", ";\n    white-space: nowrap;\n    text-shadow: none;\n    padding: ", ";\n    border-radius: ", ";\n    margin-right: ", ";\n    margin-bottom: ", ";\n  "], ["\n    display: inline-block;\n    cursor: pointer;\n    font-size: ", ";\n    line-height: ", ";\n    background-color: ", ";\n    color: ", ";\n    white-space: nowrap;\n    text-shadow: none;\n    padding: ", ";\n    border-radius: ", ";\n    margin-right: ", ";\n    margin-bottom: ", ";\n  "])), theme.typography.size.sm, theme.typography.bodySmall.lineHeight, theme.colors.background.secondary, theme.colors.text, theme.spacing(0.5), theme.shape.borderRadius(), theme.spacing(1), theme.spacing(0.5)),
    loading: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    font-weight: ", ";\n    background-color: ", ";\n    color: ", ";\n    animation: pulse 3s ease-out 0s infinite normal forwards;\n    @keyframes pulse {\n      0% {\n        color: ", ";\n      }\n      50% {\n        color: ", ";\n      }\n      100% {\n        color: ", ";\n      }\n    }\n  "], ["\n    font-weight: ", ";\n    background-color: ", ";\n    color: ", ";\n    animation: pulse 3s ease-out 0s infinite normal forwards;\n    @keyframes pulse {\n      0% {\n        color: ", ";\n      }\n      50% {\n        color: ", ";\n      }\n      100% {\n        color: ", ";\n      }\n    }\n  "])), theme.typography.fontWeightMedium, theme.colors.primary.shade, theme.colors.text.primary, theme.colors.text.primary, theme.colors.text.secondary, theme.colors.text.disabled),
    active: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    font-weight: ", ";\n    background-color: ", ";\n    color: ", ";\n  "], ["\n    font-weight: ", ";\n    background-color: ", ";\n    color: ", ";\n  "])), theme.typography.fontWeightMedium, theme.colors.primary.main, theme.colors.primary.contrastText),
    matchHighLight: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    background: inherit;\n    color: ", ";\n    background-color: ", ";\n  "], ["\n    background: inherit;\n    color: ", ";\n    background-color: ", ";\n  "])), theme.colors.primary.text, theme.colors.primary.transparent),
    hidden: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    opacity: 0.6;\n    cursor: default;\n    border: 1px solid transparent;\n  "], ["\n    opacity: 0.6;\n    cursor: default;\n    border: 1px solid transparent;\n  "]))),
    hover: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    &:hover {\n      opacity: 0.85;\n      cursor: pointer;\n    }\n  "], ["\n    &:hover {\n      opacity: 0.85;\n      cursor: pointer;\n    }\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=Label.js.map