import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

// these map to the builtin token types
enum TokenType {
  Delimiter = 'delimiter',
  Keyword = 'keyword',
  Function = 'type.identifier',
  String = 'string',
  Variable = 'variable.name',
  Number = 'number',
  Comment = 'comment',
  Operator = 'operator',
}

// Monarch language definition, see https://microsoft.github.io/monaco-editor/monarch.html
// check https://github.com/microsoft/monaco-editor/blob/main/src/basic-languages/go/go.ts for an example
// see https://pkg.go.dev/text/template for the available keywords etc
export const language: monacoType.languages.IMonarchLanguage = {
  defaultToken: '', // change this to "invalid" to find tokens that were never matched
  tokenizer: {
    root: [
      // values
      [/".*"/, TokenType.String],
      [/'.'/, TokenType.String],
      [/[0-9]+/, TokenType.Number],
      // delimiters
      [/{{-?/, TokenType.Delimiter],
      [/-?}}/, TokenType.Delimiter],
      // keywords
      ['define', TokenType.Keyword],
      ['if', TokenType.Keyword],
      ['else', TokenType.Keyword],
      ['end', TokenType.Keyword],
      ['range', TokenType.Keyword],
      ['break', TokenType.Keyword],
      ['continue', TokenType.Keyword],
      ['template', TokenType.Keyword],
      ['block', TokenType.Keyword],
      ['with', TokenType.Keyword],
      // operators
      // ['|', TokenType.Operator],
      // functions
      ['and', TokenType.Function],
      ['call', TokenType.Function],
      ['html', TokenType.Function],
      ['index', TokenType.Function],
      ['slice', TokenType.Function],
      ['js', TokenType.Function],
      ['len', TokenType.Function],
      ['not', TokenType.Function],
      ['or', TokenType.Function],
      [/print(f|ln)?/, TokenType.Function],
      ['urlquery', TokenType.Function],
      // extra functions from Prometheus
      ['join', TokenType.Function],
      // boolean functions
      ['eq', TokenType.Function],
      ['ne', TokenType.Function],
      ['lt', TokenType.Function],
      ['le', TokenType.Function],
      ['gt', TokenType.Function],
      ['ge', TokenType.Function],
      // variables
      [/\.([A-Za-z]+)?/, TokenType.Variable],
      // comments
      [/\/\*.*\*\//, TokenType.Comment],
    ],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  comments: {
    blockComment: ['/*', '*/'],
  },
  brackets: [['{{', '}}']],
  autoClosingPairs: [
    { open: '{{', close: '}}' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{{', close: '}}' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
