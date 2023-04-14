import { Grammar } from 'prismjs';

export const languageConfiguration = {
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

export const operators = ['=', '!=', '>', '<', '>=', '<=', '=~'];
export const stringOperators = ['=', '!=', '=~'];
export const numberOperators = ['=', '!=', '>', '<', '>=', '<='];

const intrinsics = ['duration', 'name', 'status', 'parent'];

const scopes: string[] = ['resource', 'span'];

const keywords = intrinsics.concat(scopes);

const statusValues = ['ok', 'unset', 'error', 'false', 'true'];

export const language = {
  ignoreCase: false,
  defaultToken: '',
  tokenPostfix: '.traceql',

  keywords,
  operators,
  statusValues,

  // we include these common regular expressions
  symbols: /[=><!~?:&|+\-*\/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,

  tokenizer: {
    root: [
      // labels
      [/[a-z_.][\w./_-]*(?=\s*(=|!=|>|<|>=|<=|=~|!~))/, 'tag'],
      [/[a-z_.][\w./_-]*/, 'tag'],

      // durations
      [/[0-9.]+(s|ms|ns|m)/, 'number'],

      // trace ID
      [/^\s*[0-9A-Fa-f]+\s*$/, 'tag'],

      // all keywords have the same color
      [
        /[a-zA-Z_.]\w*/,
        {
          cases: {
            '@keywords': 'type',
            '@statusValues': 'type.identifier',
            '@default': 'identifier',
          },
        },
      ],

      // strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

      // whitespace
      { include: '@whitespace' },

      // delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
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

    clauses: [
      [/[^(,)]/, 'tag'],
      [/\)/, 'identifier', '@pop'],
    ],

    whitespace: [[/[ \t\r\n]+/, 'white']],
  },
};

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

export const traceqlGrammar: Grammar = {
  comment: {
    pattern: /#.*/,
  },
  'span-set': {
    pattern: /\{[^}]*}/,
    inside: {
      filter: {
        pattern: /([\w.\/-]+)?(\s*)(([!=+\-<>~]+)\s*("([^"\n&]+)?"?|([^"\n\s&|}]+))?)/g,
        inside: {
          comment: {
            pattern: /#.*/,
          },
          'label-key': {
            pattern: /[a-z_.][\w./_-]*(?=\s*(=|!=|>|<|>=|<=|=~|!~))/,
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
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  operator: new RegExp(`/[-+*/=%^~]|&&?|\\|?\\||!=?|<(?:=>?|<|>)?|>[>=]?|`, 'i'),
  punctuation: /[{};()`,.]/,
};
