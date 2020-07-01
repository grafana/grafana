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
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column,
      };

      // Simple check if this was triggered by pressing `$`
      if (context.triggerCharacter === '$') {
        range.startColumn = position.column - 1;
        return {
          suggestions: getCompletionItems('$', getSuggestions(), range),
        };
      }

      // Find the replacement region
      const currentLine = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const lastSep = currentLine.lastIndexOf(' ') + 1;
      const lastVar = currentLine.lastIndexOf('$');
      const wordStart = Math.max(lastSep, lastVar);
      const currentWord = currentLine.substring(wordStart);
      range.startColumn = wordStart + 1;

      const suggestions = getCompletionItems(currentWord, getSuggestions(), range);
      if (suggestions.length) {
        return { suggestions };
      }

      // Default suggestions
      return undefined;
    },
  });
}
