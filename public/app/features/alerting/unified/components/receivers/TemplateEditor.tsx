/**
 * This file contains the template editor we'll be using for alertmanager templates.
 *
 * It includes auto-complete for template data and syntax highlighting
 */
import { editor, IDisposable, IMarkdownString, IRange, languages, Position } from 'monaco-editor';
import React, { FC, useEffect, useRef } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';
import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';

import goTemplateLanguageDefinition, { GO_TEMPLATE_LANGUAGE_ID } from './editor/definition';
import { registerLanguage } from './editor/register';

type TemplateEditorProps = Omit<CodeEditorProps, 'language' | 'theme'> & {
  autoHeight?: boolean;
};

const TemplateEditor: FC<TemplateEditorProps> = (props) => {
  const shouldAutoHeight = Boolean(props.autoHeight);
  const disposeSuggestions = useRef<IDisposable | null>(null);

  const onEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    if (shouldAutoHeight) {
      const contentHeight = editor.getContentHeight();

      try {
        // we're passing NaN in to the width because the type definition wants a number (NaN is a number, go figure)
        // but the width could be defined as a string "auto", passing NaN seems to just ignore our width update here
        editor.layout({ height: contentHeight, width: NaN });
      } catch (err) {}
    }
  };

  useEffect(() => {
    return () => {
      disposeSuggestions.current?.dispose();
    };
  });

  return (
    <CodeEditor
      showLineNumbers={true}
      // getSuggestions={getSuggestions}
      showMiniMap={false}
      {...props}
      onEditorDidMount={onEditorDidMount}
      onBeforeEditorMount={(monaco) => {
        registerLanguage(monaco, goTemplateLanguageDefinition);
        disposeSuggestions.current = registerSuggestions(monaco);
      }}
      language={GO_TEMPLATE_LANGUAGE_ID}
    />
  );
};

function registerSuggestions(monaco: Monaco) {
  return monaco.languages.registerCompletionItemProvider('go-template', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const wordBeforeDot = model.getWordUntilPosition({
        lineNumber: position.lineNumber,
        column: position.column - 1,
      });
      const word = model.getWordUntilPosition(position);

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const insideExpression = isInsideGoExpression(model, position);

      if (!insideExpression) {
        return { suggestions: [] };
      }

      switch (wordBeforeDot.word) {
        case '':
          return { suggestions: buildTopLevelSuggestions(range) };
        case 'Alerts':
          return { suggestions: buildAlertsSuggestions(range) };
        case 'GroupLabels':
        case 'CommonLabels':
        case 'CommonAnnotations':
          return { suggestions: buildKeyValueSuggestions(range) };
      }

      return {
        suggestions: [],
      };
    },
  });
}

function isInsideGoExpression(model: editor.ITextModel, position: Position) {
  const searchRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: model.getLineMinColumn(position.lineNumber),
    endColumn: model.getLineMaxColumn(position.lineNumber),
  };

  const goSyntaxRegex = '\\{\\{[a-zA-Z0-9._() "]+\\}\\}';
  const matches = model.findMatches(goSyntaxRegex, searchRange, true, false, null, true);

  return matches.some((match) => match.range.containsPosition(position));
}

function buildTopLevelSuggestions(range: IRange) {
  const globalSuggestions = [
    buildAutocompleteSuggestion({
      label: 'Alerts',
      range,
      type: 'Alert[]',
      docs: { value: 'An Array containing all alerts' },
    }),
    buildAutocompleteSuggestion({ label: 'Receiver', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'Status', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'GroupLabels', range, type: '[]KeyValue' }),
    buildAutocompleteSuggestion({ label: 'CommonLabels', range, type: '[]KeyValue' }),
    buildAutocompleteSuggestion({ label: 'CommonAnnotations', range, type: '[]KeyValue' }),
    buildAutocompleteSuggestion({ label: 'ExternalURL', range, type: 'string' }),
  ];

  const alertSuggestions = buildSingleAlertSuggestions(range);

  return [...globalSuggestions, ...alertSuggestions];
}

function buildSingleAlertSuggestions(range: IRange) {
  return [
    buildAutocompleteSuggestion({ label: 'Status', range, type: '(Alert) string' }),
    buildAutocompleteSuggestion({ label: 'Labels', range, type: '(Alert) []KeyValue' }),
    buildAutocompleteSuggestion({ label: 'Annotations', range, type: '(Alert) []KeyValue' }),
    buildAutocompleteSuggestion({ label: 'StartsAt', range, type: 'time.Time' }),
    buildAutocompleteSuggestion({ label: 'EndsAt', range, type: 'time.Time' }),
    buildAutocompleteSuggestion({ label: 'GeneratorURL', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'SilenceURL', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'DashboardURL', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'PanelURL', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'Fingerprint', range, type: 'string' }),
    buildAutocompleteSuggestion({ label: 'ValueString', range, type: 'string' }),
  ];
}

function buildAlertsSuggestions(range: IRange) {
  return [
    buildAutocompleteSuggestion({ label: 'Firing', range, type: 'Alert[]' }),
    buildAutocompleteSuggestion({ label: 'Resolved', range, type: 'Alert[]' }),
  ];
}

function buildKeyValueSuggestions(range: IRange) {
  return [
    buildAutocompleteSuggestion({ label: 'SortedPairs', range, type: '[]KeyValue' }),
    buildAutocompleteSuggestion({ label: 'Names', range, type: '[]string' }),
    buildAutocompleteSuggestion({ label: 'Values', range, type: '[]string' }),
    buildAutocompleteSuggestion({
      label: 'Remove',
      range,
      type: 'KeyValue[]',
      kind: languages.CompletionItemKind.Method,
    }),
  ];
}

interface TemplateSuggestion {
  label: string;
  range: IRange;
  type?: string;
  docs?: IMarkdownString | string;
  kind?: languages.CompletionItemKind;
}
function buildAutocompleteSuggestion({
  label,
  range,
  type,
  docs,
  kind = languages.CompletionItemKind.Field,
}: TemplateSuggestion): languages.CompletionItem {
  return {
    label: label,
    kind: kind,
    insertText: label,
    range,
    documentation: docs,
    detail: type,
  };
}

export { TemplateEditor };
