import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

// CloudWatch Logs: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html

export const DISPLAY = 'display';
export const FIELDS = 'fields';
export const FILTER = 'filter';
export const STATS = 'stats';
export const SORT = 'sort';
export const LIMIT = 'limit';
export const PARSE = 'parse';
export const UNMASK = 'unmask'; //make sure we support this one
export const LOGS_COMMANDS = [DISPLAY, FIELDS, FILTER, STATS, SORT, LIMIT, PARSE, UNMASK];

export const LOGS_OPERATORS = [
  // arithmetic
  '+',
  '-',
  '*',
  '/',
  '^',
  '%',
  // comparison
  '=',
  '!=',
  '<=',
  '>=',
  '<',
  '>',
  // boolean
  'and',
  'or',
  'not',
];

export const LOGS_FUNCTION_OPERATORS = [
  // math
  'abs',
  'ceil',
  'floor',
  'greatest',
  'least',
  'log',
  'sqrt',
  // datetime
  'bin',
  'datefloor',
  'dateceil',
  'fromMillis',
  'toMillis',
  // general
  'ispresent',
  'coalesce',
  // ip
  'isValidIp',
  'isValidIpV4',
  'isValidIpV6',
  'isIpInSubnet',
  'isIpv4InSubnet',
  'isIpv6InSubnet',
  // stats aggregation
  'avg',
  'count',
  'count_distinct',
  'max',
  'min',
  'pct',
  'stddev',
  'sum',
  // stats non-aggregation
  'earliest',
  'latest',
  'sortsFirst',
  'sortsLast',
  // strings
  'isempty',
  'isblank',
  'concat',
  'ltrim',
  'rtrim',
  'trim',
  'strlen',
  'toupper',
  'tolower',
  'substr',
  'replace',
  'strcontains',
];

export const LOGS_KEYWORDS = ['as', 'like', 'by', 'in', 'desc', 'asc'];

export const language: monacoType.languages.IMonarchLanguage = {
  defaultToken: 'invalid',
  id: 'logs',
  ignoreCase: true,
  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],
  tokenizer: {
    root: [
      { include: '@comments' },
      { include: '@whitespace' },
      { include: '@fieldNames' },
      { include: '@regexes' },
      { include: '@commands' },
      { include: '@keywords' },
      { include: '@operators' },
      { include: '@builtInFunctions' },
      { include: '@variables' },
      { include: '@strings' },
      { include: '@numbers' },

      // { include: '@complexIdentifiers' },
      [/[,.]/, 'delimiter'],
      [/[(){}]/, '@brackets'],
      [/\|/, 'operator'],
    ],
    commands: [[LOGS_COMMANDS.map(escapeRegExp).join('|'), 'keyword']],
    keywords: [[LOGS_KEYWORDS.map(escapeRegExp).join('|'), 'operator']],
    operators: [[LOGS_OPERATORS.map(escapeRegExp).join('|'), 'operator']],
    builtInFunctions: [[LOGS_FUNCTION_OPERATORS.map(escapeRegExp).join('|'), 'predefined']],
    variables: [
      [/\$[a-zA-Z0-9-_]+/, 'variable'], // $ followed by any letter/number we assume could be grafana template variable
    ],
    fieldNames: [[/(@[_a-zA-Z]+[_.0-9a-zA-Z]*)|(`((\\`)|([^`]))*?`)/, 'identifier']],
    whitespace: [[/\s+/, 'white']],
    comments: [[/#+.*/, 'comment']],
    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number'],
    ],
    strings: [
      [/'/, { token: 'string', next: '@string' }],
      [/"/, { token: 'string', next: '@string_double' }],
      [/`/, { token: 'string', next: '@string_backtick' }],
    ],
    string: [
      [/[^']+/, 'string'],
      [/''/, 'string'],
      [/'/, { token: 'string', next: '@pop' }],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/"/, 'string', '@pop'],
    ],
    string_backtick: [
      [/[^\\`]+/, 'string'],
      [/`/, 'string', '@pop'],
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
    regexes: [[/\/.*?\/(?=\||\s*$|,)/, 'regexp']],
    // TODO: handle number+unit
    periods: [[/ /, 'number']],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
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
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
