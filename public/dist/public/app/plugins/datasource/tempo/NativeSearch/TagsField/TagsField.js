import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import { CodeEditor, useTheme2 } from '@grafana/ui';
import { createErrorNotification } from '../../../../../core/copy/appNotification';
import { notifyApp } from '../../../../../core/reducers/appNotification';
import { dispatch } from '../../../../../store/store';
import { CompletionProvider } from './autocomplete';
import { languageDefinition } from './syntax';
export function TagsField(props) {
    const { onChange, onBlur, placeholder } = props;
    const setupAutocompleteFn = useAutocomplete(props.datasource);
    const theme = useTheme2();
    const styles = getStyles(theme, placeholder);
    return (React.createElement(CodeEditor, { value: props.value, language: langId, onBlur: onBlur, onChange: onChange, containerStyles: styles.queryField, monacoOptions: {
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
            setupAutocompleteFn(editor, monaco);
            setupPlaceholder(editor, monaco, styles);
            setupAutoSize(editor);
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
    return (editor, monaco) => {
        providerRef.current.editor = editor;
        providerRef.current.monaco = monaco;
        const { dispose } = monaco.languages.registerCompletionItemProvider(langId, providerRef.current);
        autocompleteDisposeFun.current = dispose;
    };
}
// we must only run the setup code once
let setupDone = false;
const langId = 'tagsfield';
function ensureTraceQL(monaco) {
    if (!setupDone) {
        setupDone = true;
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
//# sourceMappingURL=TagsField.js.map