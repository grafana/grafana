import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

interface CloudWatchLanguage extends monacoType.languages.IMonarchLanguage {
  keywords: string[];
  operators: string[];
  builtinFunctions: string[];
}

export const SELECT = 'SELECT';
export const FROM = 'FROM';
export const WHERE = 'WHERE';
export const GROUP = 'GROUP';
export const ORDER = 'ORDER';
export const BY = 'BY';
export const DESC = 'DESC';
export const ASC = 'ASC';
export const LIMIT = 'LIMIT';
export const WITH = 'WITH';
export const SCHEMA = 'SCHEMA';

export const KEYWORDS = [SELECT, FROM, WHERE, GROUP, ORDER, BY, DESC, ASC, LIMIT, WITH, SCHEMA];
export const STATISTICS = ['AVG', 'COUNT', 'MAX', 'MIN', 'SUM'];

export const AND = 'AND';
export const LOGICAL_OPERATORS = [AND];

export const EQUALS = '=';
export const NOT_EQUALS = '!=';
export const COMPARISON_OPERATORS = [EQUALS, NOT_EQUALS];

export const language: CloudWatchLanguage = {
  defaultToken: '',
  tokenPostfix: '.sql',
  ignoreCase: true,
  brackets: [
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],
  keywords: KEYWORDS,
  operators: LOGICAL_OPERATORS,
  builtinFunctions: STATISTICS,
  tokenizer: {
    root: [
      [/\$[a-zA-Z0-9-_]+/, 'variable'],
      { include: '@comments' },
      { include: '@whitespace' },
      { include: '@numbers' },
      { include: '@strings' },
      { include: '@complexIdentifiers' },
      [/[;,.]/, 'delimiter'],
      [/[()]/, '@brackets'],
      [
        /[\w@#$]+/,
        {
          cases: {
            '@keywords': 'keyword',
            '@operators': 'operator',
            '@builtinFunctions': 'predefined',
            '@default': 'identifier',
          },
        },
      ],
      [/[=!%&+\-*/|~^]/, 'operator'], // TODO: strip these options
    ],
    whitespace: [[/\s+/, 'white']],
    comments: [[/--+.*/, 'comment']],
    comment: [
      [/[^*/]+/, 'comment'],
      [/./, 'comment'],
    ],
    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number'],
    ],
    strings: [
      [/N'/, { token: 'string', next: '@string' }],
      [/'/, { token: 'string', next: '@string' }],
      [/"/, { token: 'type', next: '@string_double' }],
    ],
    string: [
      [/[^']+/, 'string'],
      [/''/, 'string'],
      [/'/, { token: 'string', next: '@pop' }],
    ],
    string_double: [
      [/[^\\"]+/, 'type'],
      [/"/, 'type', '@pop'],
    ],
    complexIdentifiers: [
      [/\[/, { token: 'identifier.quote', next: '@bracketedIdentifier' }],
      [/"/, { token: 'identifier.quote', next: '@quotedIdentifier' }],
    ],
    bracketedIdentifier: [
      [/[^\]]+/, 'identifier'],
      [/]]/, 'identifier'],
      [/]/, { token: 'identifier.quote', next: '@pop' }],
    ],
    quotedIdentifier: [
      [/[^"]+/, 'identifier'],
      [/""/, 'identifier'],
      [/"/, { token: 'identifier.quote', next: '@pop' }],
    ],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  comments: {
    lineComment: '--',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
