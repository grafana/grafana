import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { CodeEditorSuggestionItem, CodeEditorSuggestionItemKind, CodeEditorSuggestionProvider } from './types';

function getCompletionItems(
  prefix: string,
  suggestions: CodeEditorSuggestionItem[],
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  const items: monaco.languages.CompletionItem[] = [];
  for (const suggestion of suggestions) {
    if (prefix && !suggestion.label.startsWith(prefix)) {
      continue; // skip non-matching suggestions
    }

    items.push({
      ...suggestion,
      kind: mapKinds(suggestion.kind),
      range,
      insertText: suggestion.insertText ?? suggestion.label,
    });
  }
  return items;
}

function mapKinds(sug?: CodeEditorSuggestionItemKind): monaco.languages.CompletionItemKind {
  switch (sug) {
    case CodeEditorSuggestionItemKind.Method:
      return monaco.languages.CompletionItemKind.Method;
    case CodeEditorSuggestionItemKind.Field:
      return monaco.languages.CompletionItemKind.Field;
    case CodeEditorSuggestionItemKind.Property:
      return monaco.languages.CompletionItemKind.Property;
    case CodeEditorSuggestionItemKind.Constant:
      return monaco.languages.CompletionItemKind.Constant;
    case CodeEditorSuggestionItemKind.Text:
      return monaco.languages.CompletionItemKind.Text;
  }
  return monaco.languages.CompletionItemKind.Text;
}

/**
 * @alpha
 */
export function registerSuggestions(
  language: string,
  getSuggestions: CodeEditorSuggestionProvider
): monaco.IDisposable | undefined {
  if (!language || !getSuggestions) {
    return undefined;
  }
  return monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['$'],

    provideCompletionItems: (model, position, context) => {
      if (context.triggerCharacter === '$') {
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: position.column,
        };
        return {
          suggestions: getCompletionItems('$', getSuggestions(), range),
        };
      }

      // find out if we are completing a property in the 'dependencies' object.
      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const idx = lineText.lastIndexOf('$');
      if (idx >= 0) {
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: idx, // the last $ we found
          endColumn: position.column,
        };
        return {
          suggestions: getCompletionItems(lineText.substr(idx), getSuggestions(), range),
        };
      }

      // Empty line that asked for suggestion
      if (lineText.trim().length < 1) {
        return {
          suggestions: getCompletionItems('', getSuggestions(), {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column,
            endColumn: position.column,
          }),
        };
      }
      // console.log('complete?', lineText, context);
      return undefined;
    },
  });
}
