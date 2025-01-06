import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useRef, useEffect } from 'react';
import { useLatest } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { parser } from '@grafana/lezer-logql';
import { languageConfiguration, monarchlanguage } from '@grafana/monaco-logql';
import { useTheme2, ReactMonacoEditor, Monaco, monacoTypes, MonacoEditor } from '@grafana/ui';

import { Props } from './MonacoQueryFieldProps';
import { getOverrideServices } from './getOverrideServices';
import { CompletionDataProvider } from './monaco-completion-provider/CompletionDataProvider';
import { getCompletionProvider, getSuggestOptions } from './monaco-completion-provider/completionUtils';
import { placeHolderScopedVars, validateQuery } from './monaco-completion-provider/validation';

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

const LANG_ID = 'logql';

// we must only run the lang-setup code once
let LANGUAGE_SETUP_STARTED = false;

export const defaultWordPattern = /(-?\d*\.\d\w*)|([^`~!#%^&*()\-=+\[{\]}\\|;:'",.<>\/?\s]+)/g;

function ensureLogQL(monaco: Monaco) {
  if (LANGUAGE_SETUP_STARTED === false) {
    LANGUAGE_SETUP_STARTED = true;
    monaco.languages.register({ id: LANG_ID });

    monaco.languages.setMonarchTokensProvider(LANG_ID, monarchlanguage);
    monaco.languages.setLanguageConfiguration(LANG_ID, {
      ...languageConfiguration,
      wordPattern: /(-?\d*\.\d\w*)|([^`~!#%^&*()+\[{\]}\\|;:',.<>\/?\s]+)/g,
      // Default:  /(-?\d*\.\d\w*)|([^`~!#%^&*()\-=+\[{\]}\\|;:'",.<>\/?\s]+)/g
      // Removed `"`, `=`, and `-`, from the exclusion list, so now the completion provider can decide to overwrite any matching words, or just insert text at the cursor
    });
  }
}

const getStyles = (theme: GrafanaTheme2, placeholder: string) => {
  return {
    container: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.components.input.borderColor}`,
      width: '100%',
      '.monaco-editor .suggest-widget': {
        minWidth: '50%',
      },
    }),
    placeholder: css({
      '::after': {
        content: `'${placeholder}'`,
        fontFamily: theme.typography.fontFamilyMonospace,
        opacity: 0.3,
      },
    }),
  };
};

const MonacoQueryField = ({
  history,
  onBlur,
  onRunQuery,
  initialValue,
  datasource,
  placeholder,
  onChange,
  timeRange,
}: Props) => {
  const id = uuidv4();
  // we need only one instance of `overrideServices` during the lifetime of the react component
  const overrideServicesRef = useRef(getOverrideServices());
  const containerRef = useRef<HTMLDivElement>(null);

  const langProviderRef = useLatest(datasource.languageProvider);
  const historyRef = useLatest(history);
  const onRunQueryRef = useLatest(onRunQuery);
  const onBlurRef = useLatest(onBlur);
  const completionDataProviderRef = useRef<CompletionDataProvider | null>(null);

  const autocompleteCleanupCallback = useRef<(() => void) | null>(null);

  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);

  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteCleanupCallback.current?.();
    };
  }, []);

  useEffect(() => {
    if (completionDataProviderRef.current && timeRange) {
      completionDataProviderRef.current.setTimeRange(timeRange);
    }
  }, [timeRange]);

  const setPlaceholder = (monaco: Monaco, editor: MonacoEditor) => {
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
  };

  const onTypeDebounced = debounce(async (query: string) => {
    onChange(query);
  }, 1000);

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
        language={LANG_ID}
        value={initialValue}
        beforeMount={(monaco) => {
          ensureLogQL(monaco);
        }}
        onMount={(editor, monaco) => {
          // Monaco has a bug where it runs actions on all instances (https://github.com/microsoft/monaco-editor/issues/2947), so we ensure actions are executed on instance-level with this ContextKey.
          const isEditorFocused = editor.createContextKey<boolean>('isEditorFocused' + id, false);
          // we setup on-blur
          editor.onDidBlurEditorWidget(() => {
            isEditorFocused.set(false);
            onBlurRef.current(editor.getValue());
          });
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

            onTypeDebounced(query);
            monaco.editor.setModelMarkers(model, 'owner', markers);
          });
          const dataProvider = new CompletionDataProvider(langProviderRef.current, historyRef, timeRange);
          completionDataProviderRef.current = dataProvider;
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

          autocompleteCleanupCallback.current = dispose;
          // this code makes the editor resize itself so that the content fits
          // (it will grow taller when necessary)
          // FIXME: maybe move this functionality into CodeEditor, like:
          // <CodeEditor resizingMode="single-line"/>
          const handleResize = () => {
            const containerDiv = containerRef.current;
            if (containerDiv !== null) {
              const pixelHeight = editor.getContentHeight();
              containerDiv.style.height = `${pixelHeight + EDITOR_HEIGHT_OFFSET}px`;
              const pixelWidth = containerDiv.clientWidth;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(handleResize);
          handleResize();
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

          editor.onDidFocusEditorText(() => {
            isEditorFocused.set(true);
            if (editor.getValue().trim() === '') {
              editor.trigger('', 'editor.action.triggerSuggest', {});
            }
          });

          setPlaceholder(monaco, editor);
        }}
      />
    </div>
  );
};

// Default export for lazy load.
export default MonacoQueryField;
