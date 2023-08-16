import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

import { CodeEditorSuggestionItem, CodeEditorSuggestionItemKind, CodeEditorSuggestionProvider, Monaco } from './types';

/**
 * @internal -- only exported for tests
 */
export function findInsertIndex(line: string): { index: number; prefix: string } {
  for (let i = line.length - 1; i > 0; i--) {
    const ch = line.charAt(i);
    if (ch === '$') {
      return {
        index: i,
        prefix: line.substring(i),
      };
    }

    // Keep these seperators
    if (ch === ' ' || ch === '\t' || ch === '"' || ch === "'") {
      return {
        index: i + 1,
        prefix: line.substring(i + 1),
      };
    }
  }
  return {
    index: 0,
    prefix: line,
  };
}

function getCompletionItems(
  monaco: Monaco,
  prefix: string,
  suggestions: CodeEditorSuggestionItem[],
  range: monacoType.IRange
): monacoType.languages.CompletionItem[] {
  const items: monacoType.languages.CompletionItem[] = [];
  for (const suggestion of suggestions) {
    if (prefix && !suggestion.label.startsWith(prefix)) {
      continue; // skip non-matching suggestions
    }

    items.push({
      ...suggestion,
      kind: mapKinds(monaco, suggestion.kind),
      range,
      insertText: suggestion.insertText ?? suggestion.label,
    });
  }
  return items;
}

function mapKinds(monaco: Monaco, sug?: CodeEditorSuggestionItemKind): monacoType.languages.CompletionItemKind {
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
  monaco: Monaco,
  language: string,
  getSuggestions: CodeEditorSuggestionProvider,
  modelId: string
): monacoType.IDisposable | undefined {
  if (!language || !getSuggestions) {
    return undefined;
  }
  return monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ['$'],

    provideCompletionItems: (model, position, context) => {
      // only return these suggestions for the specified modelId
      // prevents duplicate suggestions when multiple editors are open
      if (model.id !== modelId) {
        return undefined;
      }
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
          suggestions: getCompletionItems(monaco, '$', getSuggestions(), range),
        };
      }

      // Find the replacement region
      const currentLine = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const { index, prefix } = findInsertIndex(currentLine);
      range.startColumn = index + 1;

      const suggestions = getCompletionItems(monaco, prefix, getSuggestions(), range);
      if (suggestions.length) {
        // NOTE, this will replace any language provided suggestions
        return { suggestions };
      }

      // Default language suggestions
      return undefined;
    },
  });
}
