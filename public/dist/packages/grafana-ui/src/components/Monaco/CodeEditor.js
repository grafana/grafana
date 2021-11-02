import { __assign, __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { ReactMonacoEditorLazy } from './ReactMonacoEditorLazy';
import { selectors } from '@grafana/e2e-selectors';
import { monacoLanguageRegistry } from '@grafana/data';
import { withTheme2 } from '../../themes';
import { registerSuggestions } from './suggestions';
var UnthemedCodeEditor = /** @class */ (function (_super) {
    __extends(UnthemedCodeEditor, _super);
    function UnthemedCodeEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.loadCustomLanguage = function () {
            var language = _this.props.language;
            var customLanguage = monacoLanguageRegistry.getIfExists(language);
            if (customLanguage) {
                return customLanguage.init();
            }
            return Promise.resolve();
        };
        // This is replaced with a real function when the actual editor mounts
        _this.getEditorValue = function () { return ''; };
        _this.onBlur = function () {
            var onBlur = _this.props.onBlur;
            if (onBlur) {
                onBlur(_this.getEditorValue());
            }
        };
        _this.onSave = function () {
            var onSave = _this.props.onSave;
            if (onSave) {
                onSave(_this.getEditorValue());
            }
        };
        _this.handleBeforeMount = function (monaco) {
            _this.monaco = monaco;
            var _a = _this.props, language = _a.language, getSuggestions = _a.getSuggestions, onBeforeEditorMount = _a.onBeforeEditorMount;
            if (getSuggestions) {
                _this.completionCancel = registerSuggestions(monaco, language, getSuggestions);
            }
            onBeforeEditorMount === null || onBeforeEditorMount === void 0 ? void 0 : onBeforeEditorMount(monaco);
        };
        _this.handleOnMount = function (editor, monaco) {
            var onEditorDidMount = _this.props.onEditorDidMount;
            _this.getEditorValue = function () { return editor.getValue(); };
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, _this.onSave);
            var languagePromise = _this.loadCustomLanguage();
            if (onEditorDidMount) {
                languagePromise.then(function () { return onEditorDidMount(editor, monaco); });
            }
        };
        return _this;
    }
    UnthemedCodeEditor.prototype.componentWillUnmount = function () {
        if (this.completionCancel) {
            this.completionCancel.dispose();
        }
    };
    UnthemedCodeEditor.prototype.componentDidUpdate = function (oldProps) {
        var _a = this.props, getSuggestions = _a.getSuggestions, language = _a.language;
        var newLanguage = oldProps.language !== language;
        var newGetSuggestions = oldProps.getSuggestions !== getSuggestions;
        if (newGetSuggestions || newLanguage) {
            if (this.completionCancel) {
                this.completionCancel.dispose();
            }
            if (!this.monaco) {
                console.warn('Monaco instance not loaded yet');
                return;
            }
            if (getSuggestions) {
                this.completionCancel = registerSuggestions(this.monaco, language, getSuggestions);
            }
        }
        if (newLanguage) {
            this.loadCustomLanguage();
        }
    };
    UnthemedCodeEditor.prototype.render = function () {
        var _a;
        var _b = this.props, theme = _b.theme, language = _b.language, width = _b.width, height = _b.height, showMiniMap = _b.showMiniMap, showLineNumbers = _b.showLineNumbers, readOnly = _b.readOnly, monacoOptions = _b.monacoOptions;
        var value = (_a = this.props.value) !== null && _a !== void 0 ? _a : '';
        var longText = value.length > 100;
        var styles = getStyles(theme);
        var options = {
            wordWrap: 'off',
            tabSize: 2,
            codeLens: false,
            contextmenu: false,
            minimap: {
                enabled: longText && showMiniMap,
                renderCharacters: false,
            },
            readOnly: readOnly,
            lineNumbersMinChars: 4,
            lineDecorationsWidth: 1 * theme.spacing.gridSize,
            overviewRulerBorder: false,
            automaticLayout: true,
            padding: {
                top: 0.5 * theme.spacing.gridSize,
                bottom: 0.5 * theme.spacing.gridSize,
            },
        };
        if (!showLineNumbers) {
            options.glyphMargin = false;
            options.folding = false;
            options.lineNumbers = 'off';
            options.lineNumbersMinChars = 0;
        }
        return (React.createElement("div", { className: styles.container, onBlur: this.onBlur, "aria-label": selectors.components.CodeEditor.container },
            React.createElement(ReactMonacoEditorLazy, { width: width, height: height, language: language, value: value, options: __assign(__assign({}, options), (monacoOptions !== null && monacoOptions !== void 0 ? monacoOptions : {})), beforeMount: this.handleBeforeMount, onMount: this.handleOnMount })));
    };
    return UnthemedCodeEditor;
}(React.PureComponent));
export var CodeEditor = withTheme2(UnthemedCodeEditor);
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-radius: ", ";\n      border: 1px solid ", ";\n    "], ["\n      border-radius: ", ";\n      border: 1px solid ", ";\n    "])), theme.shape.borderRadius(), theme.components.input.borderColor),
    };
};
var templateObject_1;
//# sourceMappingURL=CodeEditor.js.map