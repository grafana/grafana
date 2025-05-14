import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

// OpenSearch PPL syntax: https://github.com/opensearch-project/opensearch-spark/blob/0.5/ppl-spark-integration/src/main/antlr4/OpenSearchPPLParser.g4
interface CloudWatchPPLLanguage extends monacoType.languages.IMonarchLanguage {
  commands: string[];
  operators: string[];
  builtinFunctions: string[];
}

export const CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID = 'logs-ppl';

// COMMANDS
export const WHERE = 'where';
export const FIELDS = 'fields';
export const DEDUP = 'dedup';
export const STATS = 'stats';
export const EVENTSTATS = 'eventstats';
export const SORT = 'sort';
export const EVAL = 'eval';
export const HEAD = 'head';
export const TOP = 'top';
export const RARE = 'rare';
export const PARSE = 'parse';

export const PPL_COMMANDS = [WHERE, FIELDS, STATS, EVENTSTATS, DEDUP, SORT, TOP, RARE, HEAD, EVAL, PARSE];

// KEYWORDS
export const AS = 'as';
export const BY = 'by';
export const BETWEEN = 'between';
export const FROM = 'from';

// PARAMETERS
const KEEP_EMPTY = 'keepempty';
const CONSECUTIVE = 'consecutive';
const PARTITIONS = 'partitions';
const ALLNUM = 'allnum';
const DELIM = 'delim';
const DEDUP_SPLITVALUES = 'dedup_splitvalues';

export const STATS_PARAMETERS = [PARTITIONS, ALLNUM, DELIM, DEDUP_SPLITVALUES];
export const DEDUP_PARAMETERS = [KEEP_EMPTY, CONSECUTIVE];
export const PARAMETERS_WITH_BOOLEAN_VALUES = [ALLNUM, DEDUP_SPLITVALUES, KEEP_EMPTY, CONSECUTIVE];
export const BOOLEAN_LITERALS = ['true', 'false'];
export const IN = 'in';

export const ALL_KEYWORDS = [...STATS_PARAMETERS, ...DEDUP_PARAMETERS, ...BOOLEAN_LITERALS, AS, BY, IN, BETWEEN, FROM];

// FUNCTIONS
export const MATH_FUNCTIONS = [
  'abs',
  'acos',
  'asin',
  'atan',
  'atan2',
  'ceil',
  'ceiling',
  'conv',
  'cos',
  'cot',
  'crc32',
  'degrees',
  'e',
  'exp',
  'floor',
  'ln',
  'log',
  'log2',
  'log10',
  'mod',
  'pi',
  'pow',
  'power',
  'radians',
  'rand',
  'round',
  'sign',
  'sin',
  'sqrt',
  'cbrt',
];
export const DATE_TIME_FUNCTIONS = [
  'datediff',
  'day',
  'dayofmonth',
  'dayofweek',
  'dayofyear',
  'hour',
  'minute',
  'second',
  'month',
  'quarter',
  'weekday',
  'weekofyear',
  'year',
  'now',
  'curdate',
  'current_date',
];
export const TEXT_FUNCTIONS = [
  'concat',
  'concat_ws',
  'length',
  'lower',
  'ltrim',
  'reverse',
  'rtrim',
  'right',
  'substring',
  'substr',
  'trim',
  'upper',
];
export const SPAN = 'span';
export const POSITION = 'position';
export const CONDITION_FUNCTIONS = ['like', 'isnull', 'isnotnull', 'exists', 'ifnull', 'nullif', 'if', 'ispresent'];
export const SORT_FIELD_FUNCTIONS = ['auto', 'str', 'ip', 'num'];
export const PPL_FUNCTIONS = [...MATH_FUNCTIONS, ...DATE_TIME_FUNCTIONS, ...TEXT_FUNCTIONS];
export const EVAL_FUNCTIONS: string[] = [...PPL_FUNCTIONS, POSITION];
export const STATS_FUNCTIONS = [
  'avg',
  'count',
  'sum',
  'min',
  'max',
  'stddev_samp',
  'stddev_pop',
  'percentile',
  'percentile_approx',
  'distinct_count',
  'dc',
];

export const ALL_FUNCTIONS = [
  ...PPL_FUNCTIONS,
  ...STATS_FUNCTIONS,
  ...CONDITION_FUNCTIONS,
  ...SORT_FIELD_FUNCTIONS,
  POSITION,
  SPAN,
];

// OPERATORS
export const PLUS = '+';
export const MINUS = '-';
export const NOT = 'not';

export const FIELD_OPERATORS = [PLUS, MINUS];
export const ARITHMETIC_OPERATORS = [PLUS, MINUS, '*', '/', '%'];
export const COMPARISON_OPERATORS = ['>', '>=', '<', '!=', '<=', '='];
export const LOGICAL_EXPRESSION_OPERATORS = ['and', 'or', 'xor', NOT];
export const PPL_OPERATORS = [...ARITHMETIC_OPERATORS, ...LOGICAL_EXPRESSION_OPERATORS, ...COMPARISON_OPERATORS];

export const language: CloudWatchPPLLanguage = {
  defaultToken: '',
  id: CLOUDWATCH_PPL_LANGUAGE_DEFINITION_ID,
  ignoreCase: true,
  commands: PPL_COMMANDS,
  operators: PPL_OPERATORS,
  keywords: ALL_KEYWORDS,
  builtinFunctions: ALL_FUNCTIONS,
  brackets: [{ open: '(', close: ')', token: 'delimiter.parenthesis' }],
  tokenizer: {
    root: [
      { include: '@comments' },
      { include: '@regexes' },
      { include: '@whitespace' },
      { include: '@variables' },
      { include: '@strings' },
      { include: '@numbers' },

      [/[,.:]/, 'delimiter'],
      [/\|/, 'delimiter.pipe'],
      [/[()\[\]]/, 'delimiter.parenthesis'],

      [
        /[\w@#$]+/,
        {
          cases: {
            '@commands': 'keyword.command',
            '@keywords': 'keyword',
            '@builtinFunctions': 'predefined',
            '@operators': 'operator',
            '@default': 'identifier',
          },
        },
      ],
      [/[+\-*/^%=!<>]/, 'operator'], // handles the math operators
      [/[,.:]/, 'operator'],
    ],
    // template variable syntax
    variables: [
      [/\${/, { token: 'variable', next: '@variable_bracket' }],
      [/\$[a-zA-Z0-9-_]+/, 'variable'],
    ],
    variable_bracket: [
      [/[a-zA-Z0-9-_:]+/, 'variable'],
      [/}/, { token: 'variable', next: '@pop' }],
    ],
    whitespace: [[/\s+/, 'white']],
    comments: [
      [/^#.*/, 'comment'],
      [/\s+#.*/, 'comment'],
    ],
    numbers: [
      [/0[xX][0-9a-fA-F]*/, 'number'],
      [/[$][+-]*\d*(\.\d*)?/, 'number'],
      [/((\d+(\.\d*)?)|(\.\d+))([eE][\-+]?\d+)?/, 'number'],
    ],
    strings: [
      [/'/, { token: 'string', next: '@string' }],
      [/"/, { token: 'string', next: '@string_double' }],
      [/`/, { token: 'string.backtick', next: '@string_backtick' }],
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
      [/[^\\`]+/, 'string.backtick'],
      [/`/, 'string.backtick', '@pop'],
    ],
    regexes: [[/\/.*?\/(?!\s*\d)/, 'regexp']],
  },
};

export const conf: monacoType.languages.LanguageConfiguration = {
  brackets: [['(', ')']],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
  ],
};
