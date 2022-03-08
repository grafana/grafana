import React, { useRef, useEffect } from 'react';
import { useTheme2, ReactMonacoEditor, Monaco, monacoTypes } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useLatest } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { getCompletionProvider, getSuggestOptions } from './monaco-completion-provider';
import { Props } from './MonacoQueryFieldProps';
import { getOverrideServices } from './getOverrideServices';

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

const LANG_ID = 'logql';

// we must only run the lang-setup code once
let LANGUAGE_SETUP_STARTED = false;

function ensureLogQL(monaco: Monaco) {
  if (LANGUAGE_SETUP_STARTED === false) {
    LANGUAGE_SETUP_STARTED = true;
    monaco.languages.register({ id: LANG_ID });

    // loader().then((mod) => {
    //   monaco.languages.setMonarchTokensProvider(LANG_ID, mod.language);
    //   monaco.languages.setLanguageConfiguration(LANG_ID, mod.languageConfiguration);
    // });
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
  // we need only one instance of `overrideServices` during the lifetime of the react component
  const overrideServicesRef = useRef(getOverrideServices());
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
      aria-label={selectors.components.QueryField.container}
      className={styles.container}
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
    >
      <ReactMonacoEditor
        overrideServices={overrideServicesRef.current}
        options={options}
        language={LANG_ID}
        value={initialValue}
        beforeMount={(monaco) => {
          ensureLogQL(monaco);
        }}
        onMount={(editor, monaco) => {
          // we setup on-blur
          editor.onDidBlurEditorWidget(() => {
            onBlurRef.current(editor.getValue());
          });

          // we construct a DataProvider object
          const getSeriesLabels = (selector: string) =>
            lpRef.current.getSeriesLabels(selector).then((data) => data ?? {});

          const getHistory = () =>
            Promise.resolve(historyRef.current.map((h) => h.query.expr).filter((expr) => expr !== undefined));

          const getAllLabelNames = () => Promise.resolve(lpRef.current.getLabelKeys());

          const getLabelValues = (labelName: string) => lpRef.current.getLabelValues(labelName);

          const dataProvider = { getSeriesLabels, getHistory, getAllLabelNames, getLabelValues };
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

          const { dispose } = monaco.languages.registerCompletionItemProvider(LANG_ID, filteringCompletionProvider);

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
// it is against the style-guidelines.

export default MonacoQueryField;
