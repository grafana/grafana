// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/monaco-query-field/MonacoQueryField.tsx
import { css } from '@emotion/css';
import { parser } from '@prometheus-io/lezer-promql';
import { debounce } from 'lodash';
import { promLanguageDefinition } from 'monaco-promql';
import { useEffect, useRef } from 'react';
import { useLatest } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Monaco, monacoTypes, ReactMonacoEditor, useTheme2 } from '@grafana/ui';

import { Props } from './MonacoQueryFieldProps';
import { getOverrideServices } from './getOverrideServices';
import { getCompletionProvider, getSuggestOptions } from './monaco-completion-provider';
import { DataProvider } from './monaco-completion-provider/data_provider';
import { placeHolderScopedVars, validateQuery } from './monaco-completion-provider/validation';
import { language, languageConfiguration } from './promql';

const options: monacoTypes.editor.IStandaloneEditorConstructionOptions = {
  codeLens: false,
  contextmenu: false,
  // we need `fixedOverflowWidgets` because otherwise in grafana-dashboards
  // the popup is clipped by the panel-visualizations.
  fixedOverflowWidgets: true,
  folding: false,
  fontSize: 14,
  lineDecorationsWidth: 8, // used as "padding-left"
  lineNumbers: 'off',
  minimap: { enabled: false },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  padding: {
    // these numbers were picked so that visually this matches the previous version
    // of the query-editor the best
    top: 4,
    bottom: 5,
  },
  renderLineHighlight: 'none',
  scrollbar: {
    vertical: 'hidden',
    verticalScrollbarSize: 8, // used as "padding-right"
    horizontal: 'hidden',
    horizontalScrollbarSize: 0,
    alwaysConsumeMouseWheel: false,
  },
  scrollBeyondLastLine: false,
  suggest: getSuggestOptions(),
  suggestFontSize: 12,
  wordWrap: 'on',
};

// this number was chosen by testing various values. it might be necessary
// because of the width of the border, not sure.
//it needs to do 2 things:
// 1. when the editor is single-line, it should make the editor height be visually correct
// 2. when the editor is multi-line, the editor should not be "scrollable" (meaning,
//    you do a scroll-movement in the editor, and it will scroll the content by a couple pixels
//    up & down. this we want to avoid)
const EDITOR_HEIGHT_OFFSET = 2;

const PROMQL_LANG_ID = promLanguageDefinition.id;

// we must only run the promql-setup code once
let PROMQL_SETUP_STARTED = false;

function ensurePromQL(monaco: Monaco) {
  if (PROMQL_SETUP_STARTED === false) {
    PROMQL_SETUP_STARTED = true;
    const { aliases, extensions, mimetypes } = promLanguageDefinition;
    monaco.languages.register({ id: PROMQL_LANG_ID, aliases, extensions, mimetypes });

    // @ts-ignore
    monaco.languages.setMonarchTokensProvider(PROMQL_LANG_ID, language);
    // @ts-ignore
    monaco.languages.setLanguageConfiguration(PROMQL_LANG_ID, languageConfiguration);
  }
}

const getStyles = (theme: GrafanaTheme2, placeholder: string) => {
  return {
    container: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.components.input.borderColor}`,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'start',
      alignItems: 'center',
      height: '100%',
    }),
    placeholder: css({
      '::after': {
        content: `'${placeholder}'`,
        fontFamily: theme.typography.fontFamilyMonospace,
        opacity: 0.6,
      },
    }),
  };
};

const MonacoQueryField = (props: Props) => {
  const id = uuidv4();

  // we need only one instance of `overrideServices` during the lifetime of the react component
  const overrideServicesRef = useRef(getOverrideServices());
  const containerRef = useRef<HTMLDivElement>(null);
  const { languageProvider, history, onBlur, onRunQuery, initialValue, placeholder, onChange, datasource } = props;

  const lpRef = useLatest(languageProvider);
  const historyRef = useLatest(history);
  const onRunQueryRef = useLatest(onRunQuery);
  const onBlurRef = useLatest(onBlur);
  const onChangeRef = useLatest(onChange);

  const autocompleteDisposeFun = useRef<(() => void) | null>(null);

  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);

  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteDisposeFun.current?.();
    };
  }, []);

  return (
    <div
      data-testid={selectors.components.QueryField.container}
      className={styles.container}
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
    >
      <ReactMonacoEditor
        overrideServices={overrideServicesRef.current}
        options={options}
        language="promql"
        value={initialValue}
        beforeMount={(monaco) => {
          ensurePromQL(monaco);
        }}
        onMount={(editor, monaco) => {
          const isEditorFocused = editor.createContextKey<boolean>('isEditorFocused' + id, false);
          // we setup on-blur
          editor.onDidBlurEditorWidget(() => {
            isEditorFocused.set(false);
            onBlurRef.current(editor.getValue());
          });
          editor.onDidFocusEditorText(() => {
            isEditorFocused.set(true);
          });
          const dataProvider = new DataProvider({
            historyProvider: historyRef.current,
            languageProvider: lpRef.current,
          });
          const completionProvider = getCompletionProvider(monaco, dataProvider);

          // completion-providers in monaco are not registered directly to editor-instances,
          // they are registered to languages. this makes it hard for us to have
          // separate completion-providers for every query-field-instance
          // (but we need that, because they might connect to different datasources).
          // the trick we do is, we wrap the callback in a "proxy",
          // and in the proxy, the first thing is, we check if we are called from
          // "our editor instance", and if not, we just return nothing. if yes,
          // we call the completion-provider.
          const filteringCompletionProvider: monacoTypes.languages.CompletionItemProvider = {
            ...completionProvider,
            provideCompletionItems: (model, position, context, token) => {
              // if the model-id does not match, then this call is from a different editor-instance,
              // not "our instance", so return nothing
              if (editor.getModel()?.id !== model.id) {
                return { suggestions: [] };
              }
              return completionProvider.provideCompletionItems(model, position, context, token);
            },
          };

          const { dispose } = monaco.languages.registerCompletionItemProvider(
            PROMQL_LANG_ID,
            filteringCompletionProvider
          );

          autocompleteDisposeFun.current = dispose;
          // this code makes the editor resize itself so that the content fits
          // (it will grow taller when necessary)
          // FIXME: maybe move this functionality into CodeEditor, like:
          // <CodeEditor resizingMode="single-line"/>
          const updateElementHeight = () => {
            const containerDiv = containerRef.current;
            if (containerDiv !== null) {
              const pixelHeight = editor.getContentHeight();
              containerDiv.style.height = `${pixelHeight + EDITOR_HEIGHT_OFFSET}px`;
              containerDiv.style.width = '100%';
              const pixelWidth = containerDiv.clientWidth;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(updateElementHeight);
          updateElementHeight();

          // Whenever the editor changes, lets save the last value so the next query for this editor will be up-to-date.
          // This change is being introduced to fix a bug where you can submit a query via shift+enter:
          // If you clicked into another field and haven't un-blurred the active field,
          // then the query that is run will be stale, as the reference is only updated
          // with the value of the last blurred input.
          // This can run quite slowly, so we're debouncing this which should accomplish two things
          // 1. Should prevent this function from blocking the current call stack by pushing into the web API callback queue
          // 2. Should prevent a bunch of duplicates of this function being called as the user is typing
          const updateCurrentEditorValue = debounce(() => {
            const editorValue = editor.getValue();
            onChangeRef.current(editorValue);
          }, lpRef.current.datasource.getDebounceTimeInMilliseconds());

          editor.getModel()?.onDidChangeContent(() => {
            updateCurrentEditorValue();
          });

          // handle: shift + enter
          // FIXME: maybe move this functionality into CodeEditor?
          editor.addCommand(
            monaco.KeyMod.Shift | monaco.KeyCode.Enter,
            () => {
              onRunQueryRef.current(editor.getValue());
            },
            'isEditorFocused' + id
          );

          // Fixes Monaco capturing the search key binding and displaying a useless search box within the Editor.
          // See https://github.com/grafana/grafana/issues/85850
          monaco.editor.addKeybindingRule({
            keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
            command: null,
          });

          /* Something in this configuration of monaco doesn't bubble up [mod]+K, which the
                    command palette uses. Pass the event out of monaco manually
                    */
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, function () {
            global.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          });

          if (placeholder) {
            const placeholderDecorators = [
              {
                range: new monaco.Range(1, 1, 1, 1),
                options: {
                  className: styles.placeholder,
                  isWholeLine: true,
                },
              },
            ];

            let decorators: string[] = [];

            const checkDecorators: () => void = () => {
              const model = editor.getModel();

              if (!model) {
                return;
              }

              const newDecorators = model.getValueLength() === 0 ? placeholderDecorators : [];
              decorators = model.deltaDecorations(decorators, newDecorators);
            };

            checkDecorators();
            editor.onDidChangeModelContent(checkDecorators);

            editor.onDidChangeModelContent((e) => {
              const model = editor.getModel();
              if (!model) {
                return;
              }
              const query = model.getValue();
              const errors =
                validateQuery(
                  query,
                  datasource.interpolateString(query, placeHolderScopedVars),
                  model.getLinesContent(),
                  parser
                ) || [];

              const markers = errors.map(({ error, ...boundary }) => ({
                message: `${
                  error ? `Error parsing "${error}"` : 'Parse error'
                }. The query appears to be incorrect and could fail to be executed.`,
                severity: monaco.MarkerSeverity.Error,
                ...boundary,
              }));

              monaco.editor.setModelMarkers(model, 'owner', markers);
            });
          }
        }}
      />
    </div>
  );
};

// we will lazy-load this module using React.lazy,
// and that only supports default-exports,
// so we have to default-export this, even if
// it is against the style-guidelines.

export default MonacoQueryField;
