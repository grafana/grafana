export const FUNCTIONS = [
  { text: 'countof', display: 'countof()', hint: '' },
  { text: 'bin', display: 'bin()', hint: '' },
  { text: 'extentid', display: 'extentid()', hint: '' },
  { text: 'extract', display: 'extract()', hint: '' },
  { text: 'extractjson', display: 'extractjson()', hint: '' },
  { text: 'floor', display: 'floor()', hint: '' },
  { text: 'iif', display: 'iif()', hint: '' },
  { text: 'isnull', display: 'isnull()', hint: '' },
  { text: 'isnotnull', display: 'isnotnull()', hint: '' },
  { text: 'notnull', display: 'notnull()', hint: '' },
  { text: 'isempty', display: 'isempty()', hint: '' },
  { text: 'isnotempty', display: 'isnotempty()', hint: '' },
  { text: 'notempty', display: 'notempty()', hint: '' },
  { text: 'now', display: 'now()', hint: '' },
  { text: 're2', display: 're2()', hint: '' },
  { text: 'strcat', display: 'strcat()', hint: '' },
  { text: 'strlen', display: 'strlen()', hint: '' },
  { text: 'toupper', display: 'toupper()', hint: '' },
  { text: 'tostring', display: 'tostring()', hint: '' },
  { text: 'count', display: 'count()', hint: '' },
  { text: 'cnt', display: 'cnt()', hint: '' },
  { text: 'sum', display: 'sum()', hint: '' },
  { text: 'min', display: 'min()', hint: '' },
  { text: 'max', display: 'max()', hint: '' },
  { text: 'avg', display: 'avg()', hint: '' },
  {
    text: '$__timeFilter',
    display: '$__timeFilter()',
    hint: 'Macro that uses the selected timerange in Grafana to filter the query.',
  },
  {
    text: '$__escapeMulti',
    display: '$__escapeMulti()',
    hint: 'Macro to escape multi-value template variables that contain illegal characters.',
  },
  { text: '$__contains', display: '$__contains()', hint: 'Macro for multi-value template variables.' },
];

export const KEYWORDS = [
  'by',
  'on',
  'contains',
  'notcontains',
  'containscs',
  'notcontainscs',
  'startswith',
  'has',
  'matches',
  'regex',
  'true',
  'false',
  'and',
  'or',
  'typeof',
  'int',
  'string',
  'date',
  'datetime',
  'time',
  'long',
  'real',
  '​boolean',
  'bool',
  // add some more keywords
  'where',
  'order',
];

// Kusto operators
// export const OPERATORS = ['+', '-', '*', '/', '>', '<', '==', '<>', '<=', '>=', '~', '!~'];

export const DURATION = ['SECONDS', 'MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'];

const tokenizer = {
  comment: {
    pattern: /(^|[^\\:])\/\/.*/,
    lookbehind: true,
    greedy: true,
  },
  'function-context': {
    pattern: /[a-z0-9_]+\([^)]*\)?/i,
    inside: {},
  },
  duration: {
    pattern: new RegExp(`${DURATION.join('?|')}?`, 'i'),
    alias: 'number',
  },
  builtin: new RegExp(`\\b(?:${FUNCTIONS.map(f => f.text).join('|')})(?=\\s*\\()`, 'i'),
  string: {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true,
  },
  keyword: new RegExp(`\\b(?:${KEYWORDS.join('|')}|\\*)\\b`, 'i'),
  boolean: /\b(?:true|false)\b/,
  number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
  operator: /-|\+|\*|\/|>|<|==|<=?|>=?|<>|!~|~|=|\|/,
  punctuation: /[{};(),.:]/,
  variable: /(\[\[(.+?)\]\])|(\$(.+?))\b/,
};

tokenizer['function-context'].inside = {
  argument: {
    pattern: /[a-z0-9_]+(?=:)/i,
    alias: 'symbol',
  },
  duration: tokenizer.duration,
  number: tokenizer.number,
  builtin: tokenizer.builtin,
  string: tokenizer.string,
  variable: tokenizer.variable,
};

export default tokenizer;
