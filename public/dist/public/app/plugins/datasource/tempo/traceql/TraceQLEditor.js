import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, useTheme2 } from '@grafana/ui';
import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { dispatch } from '../../../../store/store';
import { CompletionProvider } from './autocomplete';
import { getErrorNodes, setErrorMarkers } from './errorHighlighting';
import { languageDefinition } from './traceql';
export function TraceQLEditor(props) {
    const { onChange, onRunQuery, placeholder } = props;
    const setupAutocompleteFn = useAutocomplete(props.datasource);
    const theme = useTheme2();
    const styles = getStyles(theme, placeholder);
    // work around the problem that `onEditorDidMount` is called once
    // and wouldn't get new version of onRunQuery
    const onRunQueryRef = useRef(onRunQuery);
    onRunQueryRef.current = onRunQuery;
    const errorTimeoutId = useRef();
    return (React.createElement(CodeEditor, { value: props.value, language: langId, onBlur: onChange, onChange: onChange, containerStyles: styles.queryField, readOnly: props.readOnly, monacoOptions: {
            folding: false,
            fontSize: 14,
            lineNumbers: 'off',
            overviewRulerLanes: 0,
            renderLineHighlight: 'none',
            scrollbar: {
                vertical: 'hidden',
                verticalScrollbarSize: 8,
                horizontal: 'hidden',
                horizontalScrollbarSize: 0,
            },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
        }, onBeforeEditorMount: ensureTraceQL, onEditorDidMount: (editor, monaco) => {
            if (!props.readOnly) {
                setupAutocompleteFn(editor, monaco, setupRegisterInteractionCommand(editor));
                setupActions(editor, monaco, () => onRunQueryRef.current());
                setupPlaceholder(editor, monaco, styles);
            }
            setupAutoSize(editor);
            // Parse query that might already exist (e.g., after a page refresh)
            const model = editor.getModel();
            if (model) {
                const errorNodes = getErrorNodes(model.getValue());
                setErrorMarkers(monaco, model, errorNodes);
            }
            // Register callback for query changes
            editor.onDidChangeModelContent((changeEvent) => {
                const model = editor.getModel();
                if (!model) {
                    return;
                }
                // Remove previous callback if existing, to prevent squiggles from been shown while the user is still typing
                window.clearTimeout(errorTimeoutId.current);
                const errorNodes = getErrorNodes(model.getValue());
                const cursorPosition = changeEvent.changes[0].rangeOffset;
                // Immediately updates the squiggles, in case the user fixed an error,
                // excluding the error around the cursor position
                setErrorMarkers(monaco, model, errorNodes.filter((errorNode) => !(errorNode.from <= cursorPosition && cursorPosition <= errorNode.to)));
                // Later on, show all errors
                errorTimeoutId.current = window.setTimeout(() => {
                    setErrorMarkers(monaco, model, errorNodes);
                }, 500);
            });
        } }));
}
function setupPlaceholder(editor, monaco, styles) {
    const placeholderDecorators = [
        {
            range: new monaco.Range(1, 1, 1, 1),
            options: {
                className: styles.placeholder,
                isWholeLine: true,
            },
        },
    ];
    let decorators = [];
    const checkDecorators = () => {
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const newDecorators = model.getValueLength() === 0 ? placeholderDecorators : [];
        decorators = model.deltaDecorations(decorators, newDecorators);
    };
    checkDecorators();
    editor.onDidChangeModelContent(checkDecorators);
}
function setupActions(editor, monaco, onRunQuery) {
    editor.addAction({
        id: 'run-query',
        label: 'Run Query',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: function () {
            onRunQuery();
        },
    });
}
function setupRegisterInteractionCommand(editor) {
    return editor.addCommand(0, function (_, label, type) {
        const properties = { datasourceType: 'tempo', type };
        // Filter out the label for TAG_VALUE completions to avoid potentially exposing sensitive data
        if (type !== 'TAG_VALUE') {
            properties.label = label;
        }
        reportInteraction('grafana_traces_traceql_completion', properties);
    });
}
function setupAutoSize(editor) {
    const container = editor.getDomNode();
    const updateHeight = () => {
        if (container) {
            const contentHeight = Math.min(1000, editor.getContentHeight());
            const width = parseInt(container.style.width, 10);
            container.style.width = `${width}px`;
            container.style.height = `${contentHeight}px`;
            editor.layout({ width, height: contentHeight });
        }
    };
    editor.onDidContentSizeChange(updateHeight);
    updateHeight();
}
/**
 * Hook that returns function that will set up monaco autocomplete for the label selector
 * @param datasource
 */
function useAutocomplete(datasource) {
    // We need the provider ref so we can pass it the label/values data later. This is because we run the call for the
    // values here but there is additional setup needed for the provider later on. We could run the getSeries() in the
    // returned function but that is run after the monaco is mounted so would delay the request a bit when it does not
    // need to.
    const providerRef = useRef(new CompletionProvider({ languageProvider: datasource.languageProvider }));
    useEffect(() => {
        const fetchTags = () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield datasource.languageProvider.start();
            }
            catch (error) {
                if (error instanceof Error) {
                    dispatch(notifyApp(createErrorNotification('Error', error)));
                }
            }
        });
        fetchTags();
    }, [datasource]);
    const autocompleteDisposeFun = useRef(null);
    useEffect(() => {
        // when we unmount, we unregister the autocomplete-function, if it was registered
        return () => {
            var _a;
            (_a = autocompleteDisposeFun.current) === null || _a === void 0 ? void 0 : _a.call(autocompleteDisposeFun);
        };
    }, []);
    // This should be run in monaco onEditorDidMount
    return (editor, monaco, registerInteractionCommandId) => {
        providerRef.current.editor = editor;
        providerRef.current.monaco = monaco;
        providerRef.current.setRegisterInteractionCommandId(registerInteractionCommandId);
        const { dispose } = monaco.languages.registerCompletionItemProvider(langId, providerRef.current);
        autocompleteDisposeFun.current = dispose;
    };
}
// we must only run the setup code once
let traceqlSetupDone = false;
const langId = 'traceql';
function ensureTraceQL(monaco) {
    if (!traceqlSetupDone) {
        traceqlSetupDone = true;
        const { aliases, extensions, mimetypes, def } = languageDefinition;
        monaco.languages.register({ id: langId, aliases, extensions, mimetypes });
        monaco.languages.setMonarchTokensProvider(langId, def.language);
        monaco.languages.setLanguageConfiguration(langId, def.languageConfiguration);
    }
}
const getStyles = (theme, placeholder) => {
    return {
        queryField: css `
      border-radius: ${theme.shape.radius.default};
      border: 1px solid ${theme.components.input.borderColor};
      flex: 1;
    `,
        placeholder: css `
      ::after {
        content: '${placeholder}';
        font-family: ${theme.typography.fontFamilyMonospace};
        opacity: 0.3;
      }
    `,
    };
};
//# sourceMappingURL=TraceQLEditor.js.map