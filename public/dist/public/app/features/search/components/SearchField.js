import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles } from '@grafana/ui';
var getSearchFieldStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    display: flex;\n    position: relative;\n    align-items: center;\n  "], ["\n    width: 100%;\n    display: flex;\n    position: relative;\n    align-items: center;\n  "]))),
    input: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    box-sizing: border-box;\n    outline: none;\n    background-color: transparent;\n    background: transparent;\n    border-bottom: 2px solid ", ";\n    font-size: 20px;\n    line-height: 38px;\n    width: 100%;\n\n    &::placeholder {\n      color: ", ";\n    }\n  "], ["\n    box-sizing: border-box;\n    outline: none;\n    background-color: transparent;\n    background: transparent;\n    border-bottom: 2px solid ", ";\n    font-size: 20px;\n    line-height: 38px;\n    width: 100%;\n\n    &::placeholder {\n      color: ", ";\n    }\n  "])), theme.colors.border1, theme.colors.textWeak),
    spacer: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    flex-grow: 1;\n  "], ["\n    flex-grow: 1;\n  "]))),
    icon: cx(css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      color: ", ";\n      padding: 0 ", ";\n    "], ["\n      color: ", ";\n      padding: 0 ", ";\n    "])), theme.colors.textWeak, theme.spacing.md)),
    clearButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    font-size: ", ";\n    color: ", ";\n    text-decoration: underline;\n\n    &:hover {\n      cursor: pointer;\n      color: ", ";\n    }\n  "], ["\n    font-size: ", ";\n    color: ", ";\n    text-decoration: underline;\n\n    &:hover {\n      cursor: pointer;\n      color: ", ";\n    }\n  "])), theme.typography.size.sm, theme.colors.textWeak, theme.colors.textStrong),
}); };
export var SearchField = function (_a) {
    var query = _a.query, onChange = _a.onChange, size = _a.size, clearable = _a.clearable, className = _a.className, inputProps = __rest(_a, ["query", "onChange", "size", "clearable", "className"]);
    var styles = useStyles(getSearchFieldStyles);
    return (React.createElement("div", { className: cx(styles.wrapper, className) },
        React.createElement("input", __assign({ type: "text", placeholder: "Search dashboards by name", value: query.query, onChange: function (event) {
                onChange(event.currentTarget.value);
            }, tabIndex: 1, spellCheck: false, className: styles.input }, inputProps)),
        React.createElement("div", { className: styles.spacer })));
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=SearchField.js.map