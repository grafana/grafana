import { monacoTypes } from '@grafana/ui';

// Stub for the Monaco instance. Only implements the parts that are used in cloudwatch sql
const getMonacoMock: (
  testData: Map<string, Array<Array<Pick<monacoTypes.Token, 'language' | 'offset' | 'type'>>>>
) => any = (testData) => ({
  editor: {
    tokenize: (value: string, languageId: string) => testData.get(value),
  },
  Range: {
    containsPosition: (range: monacoTypes.IRange, position: monacoTypes.IPosition) => {
      return (
        position.lineNumber >= range.startLineNumber &&
        position.lineNumber <= range.endLineNumber &&
        position.column >= range.startColumn &&
        position.column <= range.endColumn
      );
    },
  },
  languages: {
    CompletionItemKind: { Snippet: 2, Function: 1, Keyword: 3 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 2 },
  },
});

export { getMonacoMock };
