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

export const operators = ['=', '!=', '>', '<', '>=', '<=', '=~'];
export const stringOperators = ['=', '!=', '=~'];
export const numberOperators = ['=', '!=', '>', '<', '>=', '<='];

export const intrinsics = ['duration', 'kind', 'name', 'status'];
export const scopes: string[] = ['resource', 'span'];

export const functions = ['avg', 'min', 'max', 'sum', 'count', 'by'];

const keywords = intrinsics.concat(scopes);

const statusValues = ['ok', 'unset', 'error', 'false', 'true'];

export const language: languages.IMonarchLanguage = {
  ignoreCase: false,
  defaultToken: '',
  tokenPostfix: '.traceql',

  keywords,
  operators,
  statusValues,
  functions,

  symbols: /[=><!~?:&|+\-*\/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  digits: /\d+(_+\d+)*/,
  octaldigits: /[0-7]+(_+[0-7]+)*/,
  binarydigits: /[0-1]+(_+[0-1]+)*/,

  tokenizer: {
    root: [
      // durations
      [/[0-9]+(.[0-9]+)?(us|µs|ns|ms|s|m|h)/, 'number'],

      // trace ID
      [/^\s*[0-9A-Fa-f]+\s*$/, 'tag'],

      // functions, keywords, predefined values
      [
        /[a-zA-Z_.]\w*/,
        {
          cases: {
            '@functions': 'predefined',
            '@keywords': 'keyword',
            '@statusValues': 'type',
            '@default': 'tag',
          },
        },
      ],

      // strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/'([^'\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

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
