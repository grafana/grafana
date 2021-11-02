import { __assign, __makeTemplateObject } from "tslib";
import React, { useRef, useEffect } from 'react';
import { useTheme2, ReactMonacoEditor } from '@grafana/ui';
import { css } from '@emotion/css';
import { useLatest } from 'react-use';
import { promLanguageDefinition } from 'monaco-promql';
import { getCompletionProvider } from './monaco-completion-provider';
var options = {
    codeLens: false,
    contextmenu: false,
    // we need `fixedOverflowWidgets` because otherwise in grafana-dashboards
    // the popup is clipped by the panel-visualizations.
    fixedOverflowWidgets: true,
    folding: false,
    fontSize: 14,
    lineDecorationsWidth: 8,
    lineNumbers: 'off',
    minimap: { enabled: false },
    overviewRulerBorder: false,
    overviewRulerLanes: 0,
    padding: {
        top: 4,
        bottom: 4,
    },
    renderLineHighlight: 'none',
    scrollbar: {
        vertical: 'hidden',
    },
    scrollBeyondLastLine: false,
    suggestFontSize: 12,
    wordWrap: 'off',
};
var PROMQL_LANG_ID = promLanguageDefinition.id;
// we must only run the promql-setup code once
var PROMQL_SETUP_STARTED = false;
function ensurePromQL(monaco) {
    if (PROMQL_SETUP_STARTED === false) {
        PROMQL_SETUP_STARTED = true;
        var aliases = promLanguageDefinition.aliases, extensions = promLanguageDefinition.extensions, mimetypes = promLanguageDefinition.mimetypes, loader = promLanguageDefinition.loader;
        monaco.languages.register({ id: PROMQL_LANG_ID, aliases: aliases, extensions: extensions, mimetypes: mimetypes });
        loader().then(function (mod) {
            monaco.languages.setMonarchTokensProvider(PROMQL_LANG_ID, mod.language);
            monaco.languages.setLanguageConfiguration(PROMQL_LANG_ID, mod.languageConfiguration);
        });
    }
}
var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-radius: ", ";\n      border: 1px solid ", ";\n    "], ["\n      border-radius: ", ";\n      border: 1px solid ", ";\n    "])), theme.shape.borderRadius(), theme.components.input.borderColor),
    };
};
var MonacoQueryField = function (props) {
    var containerRef = useRef(null);
    var languageProvider = props.languageProvider, history = props.history, onBlur = props.onBlur, onRunQuery = props.onRunQuery, initialValue = props.initialValue;
    var lpRef = useLatest(languageProvider);
    var historyRef = useLatest(history);
    var onRunQueryRef = useLatest(onRunQuery);
    var onBlurRef = useLatest(onBlur);
    var autocompleteDisposeFun = useRef(null);
    var theme = useTheme2();
    var styles = getStyles(theme);
    useEffect(function () {
        // when we unmount, we unregister the autocomplete-function, if it was registered
        return function () {
            var _a;
            (_a = autocompleteDisposeFun.current) === null || _a === void 0 ? void 0 : _a.call(autocompleteDisposeFun);
        };
    }, []);
    return (React.createElement("div", { className: styles.container, 
        // NOTE: we will be setting inline-style-width/height on this element
        ref: containerRef },
        React.createElement(ReactMonacoEditor, { options: options, language: "promql", value: initialValue, beforeMount: function (monaco) {
                ensurePromQL(monaco);
            }, onMount: function (editor, monaco) {
                // we setup on-blur
                editor.onDidBlurEditorWidget(function () {
                    onBlurRef.current(editor.getValue());
                });
                // we construct a DataProvider object
                var getSeries = function (selector) { return lpRef.current.getSeries(selector); };
                var getHistory = function () {
                    return Promise.resolve(historyRef.current.map(function (h) { return h.query.expr; }).filter(function (expr) { return expr !== undefined; }));
                };
                var getAllMetricNames = function () {
                    var _a = lpRef.current, metrics = _a.metrics, metricsMetadata = _a.metricsMetadata;
                    var result = metrics.map(function (m) {
                        var _a, _b;
                        var metaItem = metricsMetadata === null || metricsMetadata === void 0 ? void 0 : metricsMetadata[m];
                        return {
                            name: m,
                            help: (_a = metaItem === null || metaItem === void 0 ? void 0 : metaItem.help) !== null && _a !== void 0 ? _a : '',
                            type: (_b = metaItem === null || metaItem === void 0 ? void 0 : metaItem.type) !== null && _b !== void 0 ? _b : '',
                        };
                    });
                    return Promise.resolve(result);
                };
                var dataProvider = { getSeries: getSeries, getHistory: getHistory, getAllMetricNames: getAllMetricNames };
                var completionProvider = getCompletionProvider(monaco, dataProvider);
                // completion-providers in monaco are not registered directly to editor-instances,
                // they are registerd to languages. this makes it hard for us to have
                // separate completion-providers for every query-field-instance
                // (but we need that, because they might connect to different datasources).
                // the trick we do is, we wrap the callback in a "proxy",
                // and in the proxy, the first thing is, we check if we are called from
                // "our editor instance", and if not, we just return nothing. if yes,
                // we call the completion-provider.
                var filteringCompletionProvider = __assign(__assign({}, completionProvider), { provideCompletionItems: function (model, position, context, token) {
                        var _a;
                        // if the model-id does not match, then this call is from a different editor-instance,
                        // not "our instance", so return nothing
                        if (((_a = editor.getModel()) === null || _a === void 0 ? void 0 : _a.id) !== model.id) {
                            return { suggestions: [] };
                        }
                        return completionProvider.provideCompletionItems(model, position, context, token);
                    } });
                var dispose = monaco.languages.registerCompletionItemProvider(PROMQL_LANG_ID, filteringCompletionProvider).dispose;
                autocompleteDisposeFun.current = dispose;
                // this code makes the editor resize itself so that the content fits
                // (it will grow taller when necessary)
                // FIXME: maybe move this functionality into CodeEditor, like:
                // <CodeEditor resizingMode="single-line"/>
                var updateElementHeight = function () {
                    var containerDiv = containerRef.current;
                    if (containerDiv !== null) {
                        var pixelHeight = editor.getContentHeight();
                        containerDiv.style.height = pixelHeight + "px";
                        containerDiv.style.width = '100%';
                        var pixelWidth = containerDiv.clientWidth;
                        editor.layout({ width: pixelWidth, height: pixelHeight });
                    }
                };
                editor.onDidContentSizeChange(updateElementHeight);
                updateElementHeight();
                // handle: shift + enter
                // FIXME: maybe move this functionality into CodeEditor?
                editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, function () {
                    onRunQueryRef.current(editor.getValue());
                });
            } })));
};
// we will lazy-load this module using React.lazy,
// and that only supports default-exports,
// so we have to default-export this, even if
// it is agains the style-guidelines.
export default MonacoQueryField;
var templateObject_1;
//# sourceMappingURL=MonacoQueryField.js.map