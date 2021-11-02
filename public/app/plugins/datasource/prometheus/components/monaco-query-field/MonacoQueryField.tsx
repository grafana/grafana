import React, { useRef, useEffect } from 'react';
import { useTheme2, ReactMonacoEditor, Monaco, monacoTypes } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useLatest } from 'react-use';
import { promLanguageDefinition } from 'monaco-promql';
import { getCompletionProvider } from './monaco-completion-provider';
import { Props } from './MonacoQueryFieldProps';

const options: monacoTypes.editor.IStandaloneEditorConstructionOptions = {
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

const PROMQL_LANG_ID = promLanguageDefinition.id;

// we must only run the promql-setup code once
let PROMQL_SETUP_STARTED = false;

function ensurePromQL(monaco: Monaco) {
  if (PROMQL_SETUP_STARTED === false) {
    PROMQL_SETUP_STARTED = true;
    const { aliases, extensions, mimetypes, loader } = promLanguageDefinition;
    monaco.languages.register({ id: PROMQL_LANG_ID, aliases, extensions, mimetypes });

    loader().then((mod) => {
      monaco.languages.setMonarchTokensProvider(PROMQL_LANG_ID, mod.language);
      monaco.languages.setLanguageConfiguration(PROMQL_LANG_ID, mod.languageConfiguration);
    });
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      border-radius: ${theme.shape.borderRadius()};
      border: 1px solid ${theme.components.input.borderColor};
    `,
  };
};

const MonacoQueryField = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { languageProvider, history, onBlur, onRunQuery, initialValue } = props;

  const lpRef = useLatest(languageProvider);
  const historyRef = useLatest(history);
  const onRunQueryRef = useLatest(onRunQuery);
  const onBlurRef = useLatest(onBlur);

  const autocompleteDisposeFun = useRef<(() => void) | null>(null);

  const theme = useTheme2();
  const styles = getStyles(theme);

  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteDisposeFun.current?.();
    };
  }, []);

  return (
    <div
      className={styles.container}
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
    >
      <ReactMonacoEditor
        options={options}
        language="promql"
        value={initialValue}
        beforeMount={(monaco) => {
          ensurePromQL(monaco);
        }}
        onMount={(editor, monaco) => {
          // we setup on-blur
          editor.onDidBlurEditorWidget(() => {
            onBlurRef.current(editor.getValue());
          });

          // we construct a DataProvider object
          const getSeries = (selector: string) => lpRef.current.getSeries(selector);

          const getHistory = () =>
            Promise.resolve(historyRef.current.map((h) => h.query.expr).filter((expr) => expr !== undefined));

          const getAllMetricNames = () => {
            const { metrics, metricsMetadata } = lpRef.current;
            const result = metrics.map((m) => {
              const metaItem = metricsMetadata?.[m];
              return {
                name: m,
                help: metaItem?.help ?? '',
                type: metaItem?.type ?? '',
              };
            });

            return Promise.resolve(result);
          };

          const dataProvider = { getSeries, getHistory, getAllMetricNames };
          const completionProvider = getCompletionProvider(monaco, dataProvider);

          // completion-providers in monaco are not registered directly to editor-instances,
          // they are registerd to languages. this makes it hard for us to have
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
              containerDiv.style.height = `${pixelHeight}px`;
              containerDiv.style.width = '100%';
              const pixelWidth = containerDiv.clientWidth;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(updateElementHeight);
          updateElementHeight();

          // handle: shift + enter
          // FIXME: maybe move this functionality into CodeEditor?
          editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
            onRunQueryRef.current(editor.getValue());
          });
        }}
      />
    </div>
  );
};

// we will lazy-load this module using React.lazy,
// and that only supports default-exports,
// so we have to default-export this, even if
// it is agains the style-guidelines.

export default MonacoQueryField;
