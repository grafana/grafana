import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

interface CloudWatchLanguage extends monacoType.languages.IMonarchLanguage {
  keywords: string[];
  operators: string[];
  builtinFunctions: string[];
}

/* KEYWORDS */
export const ALL = 'ALL';
export const AND = 'AND';
export const ANY = 'ANY';
export const AS = 'AS';
export const ASC = 'ASC';
export const BETWEEN = 'BETWEEN';
export const BY = 'BY';
export const CASE = 'CASE';
export const CUBE = 'CUBE';
export const DESC = 'DESC';
export const DISTINCT = 'DISTINCT';
export const ELSE = 'ELSE';
export const END = 'END';
export const ESCAPE = 'ESCAPE';
export const EXISTS = 'EXISTS';
export const FALSE = 'FALSE';
export const FILTER = 'FILTER';
export const FIRST = 'FIRST';
export const FROM = 'FROM';
export const GROUP = 'GROUP';
export const GROUPING = 'GROUPING';
export const HAVING = 'HAVING';
export const ILIKE = 'ILIKE';
export const IN = 'IN';
export const INNER = 'INNER';
export const IS = 'IS';
export const JOIN = 'JOIN';
export const LAST = 'LAST';
export const LEFT = 'LEFT';
export const LIKE = 'LIKE';
export const LIMIT = 'LIMIT';
export const NOT = 'NOT';
export const NULL = 'NULL';
export const ON = 'ON';
export const OR = 'OR';
export const ORDER = 'ORDER';
export const OUTER = 'OUTER';
export const ROLLUP = 'ROLLUP';
export const SELECT = 'SELECT';
export const SETS = 'SETS';
export const SOME = 'SOME';
export const THEN = 'THEN';
export const TRUE = 'TRUE';
export const USING = 'USING';
export const WHEN = 'WHEN';
export const WHERE = 'WHERE';
export const WITH = 'WITH';

export const KEYWORDS = [
  ALL,
  AND,
  ANY,
  AS,
  ASC,
  BETWEEN,
  BY,
  CASE,
  CUBE,
  DESC,
  DISTINCT,
  ELSE,
  END,
  ESCAPE,
  EXISTS,
  FALSE,
  FILTER,
  FIRST,
  FROM,
  GROUP,
  GROUPING,
  HAVING,
  ILIKE,
  IN,
  INNER,
  IS,
  JOIN,
  LAST,
  LEFT,
  LIKE,
  LIMIT,
  NOT,
  NULL,
  ON,
  OR,
  ORDER,
  OUTER,
  ROLLUP,
  SELECT,
  SETS,
  SOME,
  THEN,
  TRUE,
  USING,
  WHEN,
  WHERE,
  WITH,
];
export const AFTER_SELECT_KEYWORDS = [ALL, DISTINCT];

export const ALL_KEYWORDS = [...KEYWORDS, ...AFTER_SELECT_KEYWORDS];

/* FUNCTIONS */
export const AGGREGATE_FUNCTIONS = [
  'any',
  'any_value',
  'approx_count_distinct',
  'approx_percentile',
  'array_agg',
  'avg',
  'bit_and',
  'bit_or',
  'bit_xor',
  'bitmap_construct_agg',
  'bitmap_or_agg',
  'bool_and',
  'bool_or',
  'collect_list',
  'collect_set',
  'count',
  'count_if',
  'count_min_sketch',
  'covar_pop',
  'covar_samp',
  'every',
  'first',
  'first_value',
  'grouping',
  'grouping_id',
  'histogram_numeric',
  'hll_sketch_agg',
  'hll_union_agg',
  'kurtosis',
  'last',
  'last_value',
  'max',
  'max_by',
  'mean',
  'median',
  'min',
  'min_by',
  'mode',
  'percentile',
  'percentile_approx',
  'regr_avgx',
  'regr_avgy',
  'regr_count',
  'regr_intercept',
  'regr_r2',
  'regr_slope',
  'regr_sxx',
  'regr_sxy',
  'regr_syy',
  'skewness',
  'some',
  'std',
  'stddev',
  'stddev_pop',
  'stddev_samp',
  'sum',
  'try_avg',
  'try_sum',
  'var_pop',
  'var_samp',
  'variance',
];
export const ARRAY_FUNCTIONS = [
  'array',
  'array_append',
  'array_compact',
  'array_contains',
  'array_distinct',
  'array_except',
  'array_insert',
  'array_intersect',
  'array_join',
  'array_max',
  'array_min',
  'array_position',
  'array_prepend',
  'array_remove',
  'array_repeat',
  'array_union',
  'arrays_overlap',
  'arrays_zip',
  'flatten',
  'get',
  'sequence',
  'shuffle',
  'slice',
  'sort_array',
];
export const CONDITIONAL_FUNCTIONS = ['coalesce', 'if', 'ifnull', 'nanvl', 'nullif', 'nvl', 'nvl2'];
export const CONVERSION_FUNCTIONS = [
  'bigint',
  'binary',
  'boolean',
  'cast',
  'date',
  'decimal',
  'double',
  'float',
  'int',
  'smallint',
  'string',
  'timestamp',
  'tinyint',
];
export const DATE_AND_TIMESTAMP_FUNCTIONS = [
  'add_months',
  'convert_timezone',
  'curdate',
  'current_date',
  'current_timestamp',
  'current_timezone',
  'date_add',
  'date_diff',
  'date_format',
  'date_from_unix_date',
  'date_part',
  'date_sub',
  'date_trunc',
  'dateadd',
  'datediff',
  'datepart',
  'day',
  'dayofmonth',
  'dayofweek',
  'dayofyear',
  'extract',
  'from_unixtime',
  'from_utc_timestamp',
  'hour',
  'last_day',
  'localtimestamp',
  'localtimestamp',
  'make_date',
  'make_dt_interval',
  'make_interval',
  'make_timestamp',
  'make_timestamp_ltz',
  'make_timestamp_ntz',
  'make_ym_interval',
  'minute',
  'month',
  'months_between',
  'next_day',
  'now',
  'quarter',
  'second',
  'session_window',
  'timestamp_micros',
  'timestamp_millis',
  'timestamp_seconds',
  'to_date',
  'to_timestamp',
  'to_timestamp_ltz',
  'to_timestamp_ntz',
  'to_unix_timestamp',
  'to_utc_timestamp',
  'trunc',
  'try_to_timestamp',
  'unix_date',
  'unix_micros',
  'unix_millis',
  'unix_seconds',
  'unix_timestamp',
  'weekday',
  'weekofyear',
  'window',
  'window_time',
  'year',
];
export const JSON_FUNCTIONS = [
  'from_json',
  'get_json_object',
  'json_array_length',
  'json_object_keys',
  'json_tuple',
  'schema_of_json',
  'to_json',
];
export const MATHEMATICAL_FUNCTIONS = [
  'abs',
  'acos',
  'acosh',
  'asin',
  'asinh',
  'atan',
  'atan2',
  'atanh',
  'bin',
  'bround',
  'cbrt',
  'ceil',
  'ceiling',
  'conv',
  'cos',
  'cosh',
  'cot',
  'csc',
  'degrees',
  'e',
  'exp',
  'expm1',
  'factorial',
  'floor',
  'greatest',
  'hex',
  'hypot',
  'least',
  'ln',
  'log',
  'log10',
  'log1p',
  'log2',
  'negative',
  'pi',
  'pmod',
  'positive',
  'pow',
  'power',
  'radians',
  'rand',
  'randn',
  'random',
  'rint',
  'round',
  'sec',
  'shiftleft',
  'sign',
  'signum',
  'sin',
  'sinh',
  'sqrt',
  'tan',
  'tanh',
  'try_add',
  'try_divide',
  'try_multiply',
  'try_subtract',
  'unhex',
  'width_bucket',
];
export const PREDICATE_FUNCTIONS = ['isnan', 'isnotnull', 'isnull', 'regexp', 'regexp_like', 'rlike'];
export const STRING_FUNCTIONS = [
  'ascii',
  'base64',
  'bit_length',
  'btrim',
  'char',
  'char_length',
  'character_length',
  'chr',
  'concat_ws',
  'contains',
  'decode',
  'elt',
  'encode',
  'endswith',
  'find_in_set',
  'format_number',
  'format_string',
  'initcap',
  'instr',
  'lcase',
  'left',
  'len',
  'length',
  'levenshtein',
  'locate',
  'lower',
  'lpad',
  'ltrim',
  'luhn_check',
  'mask',
  'octet_length',
  'overlay',
  'position',
  'printf',
  'regexp_count',
  'regexp_extract',
  'regexp_extract_all',
  'regexp_instr',
  'regexp_replace',
  'regexp_substr',
  'repeat',
  'replace',
  'right',
  'rpad',
  'rtrim',
  'sentences',
  'soundex',
  'space',
  'split',
  'split_part',
  'startswith',
  'substr',
  'substring',
  'substring_index',
  'to_binary',
  'to_char',
  'to_number',
  'to_varchar',
  'translate',
  'trim',
  'try_to_binary',
  'try_to_number',
  'ucase',
  'unbase64',
  'upper',
];
export const WINDOW_FUNCTIONS = [
  'cume_dist',
  'dense_rank',
  'lag',
  'lead',
  'nth_value',
  'ntile',
  'percent_rank',
  'rank',
  'row_number',
];

export const ALL_FUNCTIONS = [
  ...AGGREGATE_FUNCTIONS,
  ...ARRAY_FUNCTIONS,
  ...CONDITIONAL_FUNCTIONS,
  ...CONVERSION_FUNCTIONS,
  ...DATE_AND_TIMESTAMP_FUNCTIONS,
  ...JSON_FUNCTIONS,
  ...MATHEMATICAL_FUNCTIONS,
  ...PREDICATE_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...WINDOW_FUNCTIONS,
];

/* OPERATORS */
export const EQUAL = '=';
export const DOUBLE_EQUALS = '==';
export const NULL_SAFE_EQUAL = '<=>';
export const NOT_EQUAL = '!=';
export const GREATER_THAN = '>';
export const GREATER_THAN_EQUAL = '>=';
export const LESS_THAN = '<';
export const LESS_THAN_EQUAL = '<=';

export const LOGICAL_OPERATORS = [OR, AND];
export const MATH_OPERATORS = ['*', '/', '+', '-', '%', 'div', 'mod'];
export const PREDICATE_OPERATORS = [
  NOT,
  IS,
  EQUAL,
  DOUBLE_EQUALS,
  NULL_SAFE_EQUAL,
  NOT_EQUAL,
  GREATER_THAN,
  GREATER_THAN_EQUAL,
  LESS_THAN,
  LESS_THAN_EQUAL,
  LIKE,
  ILIKE,
  IN,
];

export const ALL_OPERATORS = [...MATH_OPERATORS, ...LOGICAL_OPERATORS, ...PREDICATE_OPERATORS];

export const language: CloudWatchLanguage = {
  defaultToken: '',
  ignoreCase: true,
  brackets: [
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
    { open: '{', close: '}', token: 'delimiter.curly' },
  ],
  keywords: ALL_KEYWORDS,
  operators: ALL_OPERATORS,
  builtinFunctions: ALL_FUNCTIONS,
  tokenizer: {
    root: [
      { include: '@comments' },
      { include: '@whitespace' },
      { include: '@customParams' },
      { include: '@numbers' },
      { include: '@binaries' },
      { include: '@strings' },
      { include: '@strings' },
      { include: '@complexIdentifiers' },
      [/[;,.]/, 'delimiter'],
      [/[\(\)\[\]\{\}]/, '@brackets'],
      [
        /[\w@#$]+/,
        {
          cases: {
            '@operators': 'operator',
            '@builtinFunctions': 'predefined',
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
      [/[<>=!%&+\-*/|~^]/, 'operator'],
    ],
    whitespace: [[/[\s\t\r\n]+/, 'white']],
    comments: [
      [/--+.*/, 'comment'],
      [/\/\*/, { token: 'comment.quote', next: '@comment' }],
    ],
    comment: [
      [/[^*/]+/, 'comment'],
      [/\*\//, { token: 'comment.quote', next: '@pop' }],
      [/./, 'comment'],
    ],
    customParams: [
      [/\${[A-Za-z0-9._-]*}/, 'variable'],
      [/\@\@{[A-Za-z0-9._-]*}/, 'variable'],
    ],
    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number'],
    ],
    binaries: [
      [/X'/i, { token: 'binary', next: '@binarySingle' }],
      [/X"/i, { token: 'binary', next: '@binaryDouble' }],
    ],
    binarySingle: [
      [/\d+/, 'binary.escape'],
      [/''/, 'binary'],
      [/'/, { token: 'binary', next: '@pop' }],
    ],
    binaryDouble: [
      [/\d+/, 'binary.escape'],
      [/""/, 'binary'],
      [/"/, { token: 'binary', next: '@pop' }],
    ],
    strings: [
      [/'/, { token: 'string', next: '@stringSingle' }],
      [/R'/i, { token: 'string', next: '@stringSingle' }],
      [/"/, { token: 'string', next: '@stringDouble' }],
      [/R"/i, { token: 'string', next: '@stringDouble' }],
    ],
    stringSingle: [
      [/[^']+/, 'string.escape'],
      [/''/, 'string'],
      [/'/, { token: 'string', next: '@pop' }],
    ],
    stringDouble: [
      [/[^"]+/, 'string.escape'],
      [/""/, 'string'],
      [/"/, { token: 'string', next: '@pop' }],
    ],
    complexIdentifiers: [[/`/, { token: 'identifier', next: '@quotedIdentifier' }]],
    quotedIdentifier: [
      [/[^`]+/, 'identifier'],
      [/``/, 'identifier'],
      [/`/, { token: 'identifier', next: '@pop' }],
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
