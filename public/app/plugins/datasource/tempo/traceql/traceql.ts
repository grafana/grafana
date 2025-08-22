import type { languages } from 'monaco-editor';
import { Grammar } from 'prismjs';

export const languageConfiguration: languages.LanguageConfiguration = {
  // the default separators except `@$`
  wordPattern: /(-?\d*\.\d\w*)|([^`~!#%^&*()\-=+\[{\]}\\|;:'",.<>\/?\s]+)/g,
  brackets: [
    ['{', '}'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {},
};

export const operators = ['=', '!=', '>', '<', '>=', '<=', '=~', '!~'];
export const keywordOperators = ['=', '!='];
export const stringOperators = ['=', '!=', '=~', '!~'];
export const numberOperators = ['=', '!=', '>', '<', '>=', '<='];

export const intrinsicsV1 = [
  'duration',
  'kind',
  'name',
  'rootName',
  'rootServiceName',
  'status',
  'statusMessage',
  'traceDuration',
];
export const intrinsics = intrinsicsV1.concat([
  'event:name',
  'event:timeSinceStart',
  'instrumentation:name',
  'instrumentation:version',
  'link:spanID',
  'link:traceID',
  'span:duration',
  'span:id',
  'span:kind',
  'span:name',
  'span:parentID',
  'span:status',
  'span:statusMessage',
  'trace:duration',
  'trace:id',
  'trace:rootName',
  'trace:rootService',
]);
export const scopes: string[] = ['event', 'instrumentation', 'link', 'resource', 'span'];

export const enumIntrinsics = ['kind', 'span:kind', 'status', 'span:status'];

const aggregatorFunctions = ['avg', 'count', 'max', 'min', 'sum'];
const functions = aggregatorFunctions.concat([
  'by',
  'compare',
  'count_over_time',
  'min_over_time',
  'max_over_time',
  'avg_over_time',
  'sum_over_time',
  'histogram_over_time',
  'quantile_over_time',
  'rate',
  'select',
]);

// Add with clause keywords and parameters
const withClauseKeywords = ['with'];
const withParameters = ['most_recent'];

const keywords = intrinsics.concat(scopes).concat(withClauseKeywords);

const statusValues = ['ok', 'unset', 'error', 'false', 'true'];

const language: languages.IMonarchLanguage = {
  ignoreCase: false,
  defaultToken: '',
  tokenPostfix: '.traceql',

  keywords,
  operators,
  statusValues,
  functions,
  withClauseKeywords,
  withParameters,

  symbols: /[=><!~?:&|+\-*\/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,

  tokenizer: {
    root: [
      // comments
      [/\/\/.*/, 'comment'], // line comment
      [/\/\*.*\*\//, 'comment'], // block comment

      // durations
      [/[0-9]+(.[0-9]+)?(us|µs|ns|ms|s|m|h)/, 'number'],

      // trace ID
      [/^\s*[0-9A-Fa-f]+\s*$/, 'tag'],

      // with clause - match 'with' keyword
      [/\bwith\b/, { token: 'keyword', next: '@withStart' }],

      // keywords
      [
        // match only predefined keywords
        `(?:${keywords.join('|')})`,
        {
          cases: {
            '@keywords': 'keyword',
            '@default': 'tag', // fallback, but should never happen
          },
        },
      ],

      // functions and predefined values
      [
        // Inside (double) quotes, all characters are allowed, with the exception of `\` and `"` that must be escaped (`\\` and `\"`).
        // Outside quotes, some more characters are prohibited, such as `!` and `=`.
        /(?:\w|^[^{}()=~!<>&|," ]|"(?:\\"|\\\\|[^\\"])*")+/,
        {
          cases: {
            '@functions': 'predefined',
            '@statusValues': 'type',
            '@withParameters': 'variable',
            '@default': 'tag', // fallback, used for tag names
          },
        },
      ],

      // strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/([^\w])(")/, [{ token: '' }, { token: 'string', next: '@string_double' }]],
      [/([^\w])(')/, [{ token: '' }, { token: 'string', next: '@string_single' }]],
      [/([^\w])(`)/, [{ token: '' }, { token: 'string', next: '@string_back' }]],

      // delimiters and operators
      [/[{}()\[\]]/, 'delimiter.bracket'],
      [
        /@symbols/,
        {
          cases: {
            '@operators': 'delimiter',
            '@default': '',
          },
        },
      ],

      // numbers
      [/(@digits)[eE]([\-+]?(@digits))?[fFdD]?/, 'number.float'],
      [/(@digits)\.(@digits)([eE][\-+]?(@digits))?[fFdD]?/, 'number.float'],
      [/0(@octaldigits)[Ll]?/, 'number.octal'],
      [/0[bB](@binarydigits)[Ll]?/, 'number.binary'],
      [/(@digits)[fFdD]/, 'number.float'],
      [/(@digits)[lL]?/, 'number'],
    ],

    withStart: [
      [/\s+/, ''], // whitespace
      [/\(/, { token: 'delimiter.bracket', next: '@withClause' }], // opening parenthesis - enter with clause
      [/(?=.)/, { token: '', next: '@pop' }], // anything else - go back to root (use lookahead to not consume the character)
    ],

    withClause: [
      [/\s+/, ''], // whitespace
      [
        /\w+/,
        {
          // parameter names
          cases: {
            '@withParameters': 'variable',
          },
        },
      ],
      [/=/, 'delimiter'], // operator
      [/\b(true|false)\b/, 'type'], // values
      [/\)/, { token: 'delimiter.bracket', next: '@pop' }], // closing parenthesis - return to previous state
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string', '@pop'],
    ],

    string_back: [
      [/[^\\`]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/`/, 'string', '@pop'],
    ],
  },
};

// For "TraceQL" tab (Monarch editor for TraceQL)
export const languageDefinition = {
  id: 'traceql',
  extensions: ['.traceql'],
  aliases: ['tempo', 'traceql'],
  mimetypes: [],
  def: {
    language,
    languageConfiguration,
  },
};

// For "Search" tab (query builder)
export const traceqlGrammar = {
  comment: {
    pattern: /\/\/.*/,
  },
  'span-set': {
    pattern: /\{[^}]*}/,
    inside: {
      filter: {
        pattern:
          /([\w:.\/-]+)\s*(=|!=|<=|>=|=~|!~|>|<)\s*("[^"]*"|[\w.\/-]+)(\s*(\&\&|\|\|)\s*([\w:.\/-]+)\s*(=|!=|<=|>=|=~|!~|>|<)\s*("[^"]*"|[\w.\/-]+))*/g,
        inside: {
          comment: {
            pattern: /#.*/,
          },
          'label-key': {
            pattern: /[a-z_.][\w./_-]*(:[\w./_-]+)?(?=\s*(=|!=|>|<|>=|<=|=~|!~))/,
            alias: 'attr-name',
          },
          'label-value': {
            pattern: /("(?:\\.|[^\\"])*")|(\w+)/,
            alias: 'attr-value',
          },
        },
      },
      punctuation: /[}{&|]/,
    },
  },
  'with-clause': {
    pattern: /\bwith\s*\([^)]*\)/,
    inside: {
      'with-keyword': {
        pattern: /\bwith\b/,
        alias: 'keyword',
      },
      'parameter-name': {
        pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*=)/,
        alias: 'attr-name',
      },
      'parameter-value': {
        pattern: /\b(true|false)\b|"(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'|\d+(?:\.\d+)?/,
        alias: 'attr-value',
      },
      punctuation: /[()=,]/,
    },
  },
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  operator: new RegExp(`/[-+*/=%^~]|&&?|\\|?\\||!=?|<(?:=>?|<|>)?|>[>=]?|`, 'i'),
  punctuation: /[{};()`,.]/,
} satisfies Grammar;
