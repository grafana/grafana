import { __makeTemplateObject } from "tslib";
import React, { useMemo } from 'react';
import { css, cx } from '@emotion/css';
import AutoSizer from 'react-virtualized-auto-sizer';
import { CodeEditor, stylesFactory, useTheme, variableSuggestionToCodeEditorSuggestion, } from '@grafana/ui';
import { TextMode } from './models.gen';
export var TextPanelEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange, context = _a.context;
    var language = useMemo(function () { var _a, _b; return (_b = (_a = context.options) === null || _a === void 0 ? void 0 : _a.mode) !== null && _b !== void 0 ? _b : TextMode.Markdown; }, [context]);
    var theme = useTheme();
    var styles = getStyles(theme);
    var getSuggestions = function () {
        if (!context.getSuggestions) {
            return [];
        }
        return context.getSuggestions().map(function (v) { return variableSuggestionToCodeEditorSuggestion(v); });
    };
    return (React.createElement("div", { className: cx(styles.editorBox) },
        React.createElement(AutoSizer, { disableHeight: true }, function (_a) {
            var width = _a.width;
            if (width === 0) {
                return null;
            }
            return (React.createElement(CodeEditor, { value: value, onBlur: onChange, onSave: onChange, language: language, width: width, showMiniMap: false, showLineNumbers: false, height: "200px", getSuggestions: getSuggestions }));
        })));
};
var getStyles = stylesFactory(function (theme) { return ({
    editorBox: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: editorBox;\n    border: ", " solid ", ";\n    border-radius: ", ";\n    margin: ", " 0;\n    width: 100%;\n  "], ["\n    label: editorBox;\n    border: ", " solid ", ";\n    border-radius: ", ";\n    margin: ", " 0;\n    width: 100%;\n  "])), theme.border.width.sm, theme.colors.border2, theme.border.radius.sm, theme.spacing.xs),
}); });
var templateObject_1;
//# sourceMappingURL=TextPanelEditor.js.map