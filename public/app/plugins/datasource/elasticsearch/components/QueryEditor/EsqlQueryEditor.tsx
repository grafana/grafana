import { Parser, WrappingPrettyPrinter } from '@elastic/esql';
import { monarch } from '@elastic/monaco-esql';
import * as monarchDefinitions from '@elastic/monaco-esql/lib/definitions';
import { useCallback, useEffect, useRef } from 'react';

import { Monaco, monacoTypes } from '@grafana/ui';

import { RawQueryEditor, RawQueryEditorProps } from './RawQueryEditor';

const ESQL_LANG_ID = 'esql';
const ESQL_MARKER_OWNER = 'esql-parse-validation';
const NOT_ALLOWED_SOURCE_COMMANDS = ['PROMQL'];

// Monaco language registration is global, so we only do this once per page lifecycle.
let ESQL_SETUP_STARTED = false;

function ensureESQL(monaco: Monaco) {
  if (ESQL_SETUP_STARTED) {
    return;
  }

  ESQL_SETUP_STARTED = true;
  monaco.languages.register({ id: ESQL_LANG_ID });
  monaco.languages.setMonarchTokensProvider(
    ESQL_LANG_ID,
    monarch.create({
      ...monarchDefinitions,
    })
  );

  monaco.languages.registerDocumentFormattingEditProvider(ESQL_LANG_ID, {
    provideDocumentFormattingEdits: (model) => {
      try {
        const source = model.getValue();
        const { root, errors } = Parser.parse(source);

        // Avoid rewriting text while the query is syntactically invalid.
        if (errors.length > 0) {
          return [];
        }

        const formatted = WrappingPrettyPrinter.print(root, { multiline: true });
        return [
          {
            range: model.getFullModelRange(),
            text: formatted,
          },
        ];
      } catch {
        return [];
      }
    },
  });
}

function getEsqlSuggestions(monaco: Monaco): Array<Omit<monacoTypes.languages.CompletionItem, 'range'>> {
  const keywords = [
    ...monarchDefinitions.headerCommands,
    ...monarchDefinitions.sourceCommands.filter((command) => !NOT_ALLOWED_SOURCE_COMMANDS.includes(command)),
    ...monarchDefinitions.processingCommands,
    ...monarchDefinitions.options,
    ...monarchDefinitions.literals,
    ...monarchDefinitions.operators.named.binary,
    ...monarchDefinitions.operators.named.other,
    ...monarchDefinitions.temporalUnits.flat(),
  ];

  const keywordSuggestions = Array.from(new Set(keywords)).map((label) => ({
    label,
    insertText: label,
    kind: monaco.languages.CompletionItemKind.Keyword,
  }));

  // Insert function placeholders as snippets so users can tab directly into arguments.
  const functionSuggestions = Array.from(new Set(monarchDefinitions.functions)).map((name) => ({
    label: name,
    insertText: `${name}($0)`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    kind: monaco.languages.CompletionItemKind.Function,
  }));

  return [...keywordSuggestions, ...functionSuggestions];
}

type EsqlQueryEditorProps = Omit<RawQueryEditorProps, 'language' | 'onBeforeEditorMount' | 'onEditorDidMount'>;

export function EsqlQueryEditor(props: EsqlQueryEditorProps) {
  const completionProviderDisposeRef = useRef<monacoTypes.IDisposable | null>(null);
  const parseValidationDisposeRef = useRef<monacoTypes.IDisposable | null>(null);
  const parseValidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // Dispose Monaco registrations/listeners to avoid leaks on remount.
      completionProviderDisposeRef.current?.dispose();
      completionProviderDisposeRef.current = null;
      parseValidationDisposeRef.current?.dispose();
      parseValidationDisposeRef.current = null;
      if (parseValidationTimerRef.current) {
        clearTimeout(parseValidationTimerRef.current);
        parseValidationTimerRef.current = null;
      }
    };
  }, []);

  const handleBeforeEditorMount = useCallback((monaco: Monaco) => {
    ensureESQL(monaco);
  }, []);

  const handleEditorDidMount = useCallback((editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    ensureESQL(monaco);
    // Used to ignore validation results from an older parse after newer keystrokes.
    let parseVersion = 0;

    completionProviderDisposeRef.current?.dispose();
    completionProviderDisposeRef.current = monaco.languages.registerCompletionItemProvider(ESQL_LANG_ID, {
      provideCompletionItems: (model, position) => {
        // Completion providers are registered per-language, so this keeps results bound to this editor only.
        if (editor.getModel()?.id !== model.id) {
          return { suggestions: [] };
        }

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: getEsqlSuggestions(monaco).map((suggestion) => ({
            ...suggestion,
            range,
          })),
        };
      },
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
    });

    const runParseValidation = () => {
      const model = editor.getModel();
      if (!model || model.getLanguageId() !== ESQL_LANG_ID) {
        return;
      }

      const currentVersion = ++parseVersion;
      const source = model.getValue();

      try {
        const { errors } = Parser.parse(source);
        if (currentVersion !== parseVersion) {
          return;
        }

        const markers: monacoTypes.editor.IMarkerData[] = errors.map((error) => ({
          severity: error.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
          message: error.message,
          startLineNumber: error.startLineNumber,
          startColumn: error.startColumn,
          endLineNumber: error.endLineNumber,
          endColumn: error.endColumn,
        }));

        monaco.editor.setModelMarkers(model, ESQL_MARKER_OWNER, markers);
      } catch (error) {
        if (currentVersion !== parseVersion) {
          return;
        }

        monaco.editor.setModelMarkers(model, ESQL_MARKER_OWNER, [
          {
            severity: monaco.MarkerSeverity.Error,
            message: error instanceof Error ? error.message : 'Unable to parse ES|QL query',
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 2,
          },
        ]);
      }
    };

    parseValidationDisposeRef.current?.dispose();
    parseValidationDisposeRef.current = editor.onDidChangeModelContent(() => {
      if (parseValidationTimerRef.current) {
        clearTimeout(parseValidationTimerRef.current);
      }
      // Small debounce to keep parsing responsive while typing quickly.
      parseValidationTimerRef.current = setTimeout(() => {
        runParseValidation();
      }, 120);
    });

    // Validate initial content immediately so prefilled queries get markers too.
    runParseValidation();
  }, []);

  return (
    <RawQueryEditor
      {...props}
      language={ESQL_LANG_ID}
      onBeforeEditorMount={handleBeforeEditorMount}
      onEditorDidMount={handleEditorDidMount}
    />
  );
}
