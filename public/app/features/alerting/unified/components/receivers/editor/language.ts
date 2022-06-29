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
  Identifier = 'idenfifier',
}

// Monarch language definition, see https://microsoft.github.io/monaco-editor/monarch.html
// check https://github.com/microsoft/monaco-editor/blob/main/src/basic-languages/go/go.ts for an example
// see https://pkg.go.dev/text/template for the available keywords etc
export const language: monacoType.languages.IMonarchLanguage = {
  defaultToken: '', // change this to "invalid" to find tokens that were never matched
  keywords: ['define', 'if', 'else', 'end', 'range', 'break', 'continue', 'template', 'block', 'with'],
  functions: [
    // built-in functions
    'and',
    'call',
    'html',
    'index',
    'slice',
    'js',
    'len',
    'not',
    'or',
    'print',
    'printf',
    'println',
    'urlquery',
    // boolean functions
    'eq',
    'ne',
    'lt',
    'le',
    'gt',
    'ge',
    // extra functions
    'join',
  ],
  operators: ['|'],
  tokenizer: {
    root: [
      // strings
      [/"/, TokenType.String, '@string'],
      [/`/, TokenType.String, '@rawstring'],
      // numbers
      [/\d*\d+[eE]([\-+]?\d+)?/, 'number.float'],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F']*[0-9a-fA-F]/, 'number.hex'],
      [/0[0-7']*[0-7]/, 'number.octal'],
      [/0[bB][0-1']*[0-1]/, 'number.binary'],
      [/\d[\d']*/, TokenType.Number],
      [/\d/, TokenType.Number],
      // delimiter: after number because of .\d floats
      [/[;,.]/, TokenType.Delimiter],
      // delimiters
      [/{{-?/, TokenType.Delimiter],
      [/-?}}/, TokenType.Delimiter],
      // variables
      // [/\.([A-Za-z]+)?/, TokenType.Variable],
      // identifiers and keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': { token: TokenType.Keyword },
            '@functions': { token: TokenType.Function },
            '@default': TokenType.Identifier,
          },
        },
      ],
      // comments
      [/\/\*.*\*\//, TokenType.Comment],
    ],
    string: [
      [/[^\\"]+/, TokenType.String],
      [/\\./, 'string.escape.invalid'],
      [/"/, TokenType.String, '@pop'],
    ],
    rawstring: [
      [/[^\`]/, TokenType.String],
      [/`/, TokenType.String, '@pop'],
    ],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  comments: {
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{{', '}}'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{{', close: '}}' },
    { open: '(', close: ')' },
    { open: '`', close: '`' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{{', close: '}}' },
    { open: '(', close: ')' },
    { open: '`', close: '`' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
