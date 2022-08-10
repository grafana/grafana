/**
 * This file contains the template editor we'll be using for alertmanager templates.
 *
 * It includes auto-complete for template data and syntax highlighting
 */
import { editor, IMarkdownString, IRange, languages } from 'monaco-editor';
import React, { FC } from 'react';

import { CodeEditor, Monaco } from '@grafana/ui';
import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';

import goTemplateLanguageDefinition, { GO_TEMPLATE_LANGUAGE_ID } from './editor/definition';
import { registerLanguage } from './editor/register';

type TemplateEditorProps = Omit<CodeEditorProps, 'language' | 'theme'> & {
  autoHeight?: boolean;
};

const TemplateEditor: FC<TemplateEditorProps> = (props) => {
  const shouldAutoHeight = Boolean(props.autoHeight);

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

  return (
    <CodeEditor
      showLineNumbers={true}
      // getSuggestions={getSuggestions}
      showMiniMap={false}
      {...props}
      onEditorDidMount={onEditorDidMount}
      onBeforeEditorMount={(monaco) => {
        registerLanguage(monaco, goTemplateLanguageDefinition);
        registerSuggestions(monaco);
      }}
      language={GO_TEMPLATE_LANGUAGE_ID}
    />
  );
};

function registerSuggestions(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider('go-template', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const wordBeforeDot = model.getWordUntilPosition({
        lineNumber: position.lineNumber,
        column: position.column - 1,
      });
      const word = model.getWordUntilPosition(position);

      console.log(wordBeforeDot);

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      if (!wordBeforeDot.word) {
        return { suggestions: buildTopLevelSuggestions(range) };
      } else if (wordBeforeDot.word === 'Alerts') {
        return { suggestions: buildAlertsSuggestions(range) };
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

function buildTopLevelSuggestions(range: IRange) {
  return [
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
