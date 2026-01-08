import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { TemporaryAlert } from '@grafana/o11y-ds-frontend';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, Monaco, monacoTypes, useTheme2 } from '@grafana/ui';

import { DEFAULT_TIME_RANGE_FOR_TAGS } from '../configuration/TagsTimeRangeSettings';
import { TempoDatasource } from '../datasource';
import { TempoQuery } from '../types';

import { CompletionProvider, CompletionItemType } from './autocomplete';
import { getErrorNodes, setMarkers } from './highlighting';
import { languageDefinition } from './traceql';

interface Props {
  placeholder: string;
  query: TempoQuery;
  onChange: (val: TempoQuery) => void;
  onRunQuery: () => void;
  datasource: TempoDatasource;
  readOnly?: boolean;
  range?: TimeRange;
}

export function TraceQLEditor(props: Props) {
  const [alertText, setAlertText] = useState<string>();

  const { query, onChange, onRunQuery, placeholder } = props;
  const setupAutocompleteFn = useAutocomplete(
    props.datasource,
    setAlertText,
    props.datasource.timeRangeForTags ?? DEFAULT_TIME_RANGE_FOR_TAGS,
    props.range
  );
  const theme = useTheme2();
  const styles = getStyles(theme, placeholder);

  // The Monaco Editor uses the first version of props.onChange in handleOnMount i.e. always has the initial
  // value of query because underlying Monaco editor is passed `query` below in the onEditorChange callback.
  // handleOnMount is called only once when the editor is mounted and does not get updates to query.
  // So we need useRef to get the latest version of query in the onEditorChange callback.
  const queryRef = useRef(query);
  queryRef.current = query;
  const onEditorChange = (value: string) => {
    onChange({ ...queryRef.current, query: value });
  };

  // work around the problem that `onEditorDidMount` is called once
  // and wouldn't get new version of onRunQuery
  const onRunQueryRef = useRef(onRunQuery);
  onRunQueryRef.current = onRunQuery;

  const errorTimeoutId = useRef<number>();

  return (
    <>
      <CodeEditor
        value={query.query || ''}
        language={langId}
        onBlur={onEditorChange}
        onChange={onEditorChange}
        containerStyles={styles.queryField}
        readOnly={props.readOnly}
        monacoOptions={{
          folding: false,
          fontSize: 14,
          lineNumbers: 'off',
          overviewRulerLanes: 0,
          renderLineHighlight: 'none',
          scrollbar: {
            vertical: 'hidden',
            verticalScrollbarSize: 8, // used as "padding-right"
            horizontal: 'hidden',
            horizontalScrollbarSize: 0,
          },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
        onBeforeEditorMount={ensureTraceQL}
        onEditorDidMount={(editor, monaco) => {
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
            setMarkers(monaco, model, errorNodes);
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
            setMarkers(
              monaco,
              model,
              errorNodes.filter((errorNode) => !(errorNode.from <= cursorPosition && cursorPosition <= errorNode.to))
            );

            // Show all errors after a short delay, to avoid flickering
            errorTimeoutId.current = window.setTimeout(() => {
              setMarkers(monaco, model, errorNodes);
            }, 500);
          });
        }}
      />
      {alertText && <TemporaryAlert severity="error" text={alertText} />}
    </>
  );
}

function setupPlaceholder(editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco, styles: EditorStyles) {
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

  const checkDecorators = (): void => {
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

function setupActions(editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco, onRunQuery: () => void) {
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

function setupRegisterInteractionCommand(editor: monacoTypes.editor.IStandaloneCodeEditor): string | null {
  return editor.addCommand(0, function (_, label, type: CompletionItemType) {
    const properties: Record<string, unknown> = { datasourceType: 'tempo', type };
    // Filter out the label for TAG_VALUE completions to avoid potentially exposing sensitive data
    if (type !== 'TAG_VALUE') {
      properties.label = label;
    }
    reportInteraction('grafana_traces_traceql_completion', properties);
  });
}

function setupAutoSize(editor: monacoTypes.editor.IStandaloneCodeEditor) {
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
 * @param datasource the Tempo datasource instance
 * @param setAlertText setter for alert's text
 * @param timeRangeForTags time range for tags and tag values queries
 * @param range time range
 */
function useAutocomplete(
  datasource: TempoDatasource,
  setAlertText: (text?: string) => void,
  timeRangeForTags: number,
  range?: TimeRange
) {
  // We need the provider ref so we can pass it the label/values data later. This is because we run the call for the
  // values here but there is additional setup needed for the provider later on. We could run the getSeries() in the
  // returned function but that is run after the monaco is mounted so would delay the request a bit when it does not
  // need to.
  const providerRef = useRef<CompletionProvider>(
    new CompletionProvider({
      languageProvider: datasource.languageProvider,
      setAlertText,
      timeRangeForTags,
      range,
    })
  );

  const previousRangeRef = useRef<TimeRange | undefined>(range);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        await datasource.languageProvider.start(range, timeRangeForTags);
        setAlertText(undefined);
      } catch (error) {
        if (error instanceof Error) {
          setAlertText(`Error: ${error.message}`);
        }
      }
    };
    fetchTags();
  }, [datasource, setAlertText, range, timeRangeForTags]);

  useEffect(() => {
    const rangeChanged = datasource.languageProvider.shouldRefreshLabels(range, previousRangeRef.current);

    if (rangeChanged) {
      providerRef.current.range = range;
      previousRangeRef.current = range;
    }
  }, [range, datasource.languageProvider]);

  useEffect(() => {
    providerRef.current.timeRangeForTags = timeRangeForTags;
  }, [timeRangeForTags]);

  const autocompleteDisposeFun = useRef<(() => void) | null>(null);
  useEffect(() => {
    // when we unmount, we unregister the autocomplete-function, if it was registered
    return () => {
      autocompleteDisposeFun.current?.();
    };
  }, []);

  // This should be run in monaco onEditorDidMount
  return (
    editor: monacoTypes.editor.IStandaloneCodeEditor,
    monaco: Monaco,
    registerInteractionCommandId: string | null
  ) => {
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

function ensureTraceQL(monaco: Monaco) {
  if (!traceqlSetupDone) {
    traceqlSetupDone = true;
    const { aliases, extensions, mimetypes, def } = languageDefinition;
    monaco.languages.register({ id: langId, aliases, extensions, mimetypes });
    monaco.languages.setMonarchTokensProvider(langId, def.language);
    monaco.languages.setLanguageConfiguration(langId, def.languageConfiguration);
  }
}

interface EditorStyles {
  placeholder: string;
  queryField: string;
}

const getStyles = (theme: GrafanaTheme2, placeholder: string): EditorStyles => {
  return {
    queryField: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.components.input.borderColor}`,
      flex: 1,
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
