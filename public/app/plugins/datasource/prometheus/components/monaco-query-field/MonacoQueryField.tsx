import React, { useRef, useEffect } from 'react';
import { CodeEditor, CodeEditorMonacoOptions, Monaco, monacoTypes } from '@grafana/ui';
import { useLatest } from 'react-use';
import { promLanguageDefinition } from 'monaco-promql';
import { getCompletionProvider } from './monaco-completion-provider';
import { Props } from './MonacoQueryFieldProps';

const options: CodeEditorMonacoOptions = {
  lineNumbers: 'off',
  minimap: { enabled: false },
  lineDecorationsWidth: 0,
  wordWrap: 'off',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  folding: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'none',
  fontSize: 14,
  suggestFontSize: 12,
  // we need `fixedOverflowWidgets` because otherwise in grafana-dashboards
  // the popup is clipped by the panel-visualizations.
  fixedOverflowWidgets: true,
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

const MonacoQueryField = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { languageProvider, history, onChange, initialValue } = props;

  const lpRef = useLatest(languageProvider);
  const historyRef = useLatest(history);

  const autocompleteDisposeFun = useRef<(() => void) | null>(null);

  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteDisposeFun.current?.();
    };
  }, []);

  return (
    <div
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
      style={{
        // FIXME:
        // this is how the non-monaco query-editor is styled,
        // through the "gf-form" class
        // so to have the same effect, we do the same.
        // this should be applied somehow differently probably,
        // like a min-height on the whole row.
        marginBottom: '4px',
      }}
    >
      <CodeEditor
        onBlur={onChange}
        monacoOptions={options}
        language="promql"
        value={initialValue}
        onBeforeEditorMount={ensurePromQL}
        onEditorDidMount={(editor, monaco) => {
          // we construct a DataProvider object
          const getSeries = (selector: string) => lpRef.current.getSeries(selector);

          const getHistory = () =>
            Promise.resolve(historyRef.current.map((h) => h.query.expr).filter((expr) => expr !== undefined));

          const getAllMetricNames = () => {
            const { metrics, metricsMetadata } = lpRef.current;
            const result = metrics.map((m) => {
              const metaItem = metricsMetadata?.[m]?.[0];
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
            const text = editor.getValue();
            props.onChange(text);
            props.onRunQuery();
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
