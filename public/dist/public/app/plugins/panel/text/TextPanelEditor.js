import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { CodeEditor, useStyles2, variableSuggestionToCodeEditorSuggestion, } from '@grafana/ui';
import { TextMode } from './panelcfg.gen';
export const TextPanelEditor = ({ value, onChange, context }) => {
    const language = useMemo(() => { var _a, _b; return (_b = (_a = context.options) === null || _a === void 0 ? void 0 : _a.mode) !== null && _b !== void 0 ? _b : TextMode.Markdown; }, [context]);
    const styles = useStyles2(getStyles);
    const getSuggestions = () => {
        if (!context.getSuggestions) {
            return [];
        }
        return context.getSuggestions().map((v) => variableSuggestionToCodeEditorSuggestion(v));
    };
    return (React.createElement("div", { className: cx(styles.editorBox) },
        React.createElement(AutoSizer, { disableHeight: true }, ({ width }) => {
            if (width === 0) {
                return null;
            }
            return (React.createElement(CodeEditor, { value: value, onBlur: onChange, onSave: onChange, language: language, width: width, showMiniMap: false, showLineNumbers: false, height: "500px", getSuggestions: getSuggestions }));
        })));
};
const getStyles = (theme) => ({
    editorBox: css `
    label: editorBox;
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    margin: ${theme.spacing(0.5)} 0;
    width: 100%;
  `,
});
//# sourceMappingURL=TextPanelEditor.js.map