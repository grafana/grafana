import { Grammar } from 'prismjs';

import { CompletionItem } from '@grafana/ui';

export const AGGREGATION_OPERATORS: CompletionItem[] = [
  {
    label: 'avg',
    insertText: 'avg',
    documentation: 'Calculate the average over dimensions',
  },
  {
    label: 'bottomk',
    insertText: 'bottomk',
    documentation: 'Smallest k elements by sample value',
  },
  {
    label: 'count',
    insertText: 'count',
    documentation: 'Count number of elements in the vector',
  },
  {
    label: 'max',
    insertText: 'max',
    documentation: 'Select maximum over dimensions',
  },
  {
    label: 'min',
    insertText: 'min',
    documentation: 'Select minimum over dimensions',
  },
  {
    label: 'stddev',
    insertText: 'stddev',
    documentation: 'Calculate population standard deviation over dimensions',
  },
  {
    label: 'stdvar',
    insertText: 'stdvar',
    documentation: 'Calculate population standard variance over dimensions',
  },
  {
    label: 'sum',
    insertText: 'sum',
    documentation: 'Calculate sum over dimensions',
  },
  {
    label: 'topk',
    insertText: 'topk',
    documentation: 'Largest k elements by sample value',
  },
];

export const PIPE_PARSERS: CompletionItem[] = [
  {
    label: 'json',
    insertText: 'json',
    documentation: 'Extracting labels from the log line using json parser.',
  },
  {
    label: 'regexp',
    insertText: 'regexp ""',
    documentation: 'Extracting labels from the log line using regexp parser.',
    move: -1,
  },
  {
    label: 'logfmt',
    insertText: 'logfmt',
    documentation: 'Extracting labels from the log line using logfmt parser.',
  },
  {
    label: 'pattern',
    insertText: 'pattern',
    documentation: 'Extracting labels from the log line using pattern parser. Only available in Loki 2.3+.',
  },
  {
    label: 'unpack',
    insertText: 'unpack',
    detail: 'unpack identifier',
    documentation:
      'Parses a JSON log line, unpacking all embedded labels in the pack stage. A special property "_entry" will also be used to replace the original log line. Only available in Loki 2.2+.',
  },
];

export const PIPE_OPERATORS: CompletionItem[] = [
  {
    label: 'unwrap',
    insertText: 'unwrap',
    detail: 'unwrap identifier',
    documentation: 'Take labels and use the values as sample data for metric aggregations.',
  },
  {
    label: 'label_format',
    insertText: 'label_format',
    documentation: 'Use to rename, modify or add labels. For example, | label_format foo=bar .',
  },
  {
    label: 'line_format',
    insertText: 'line_format',
    documentation: 'Rewrites log line content. For example, | line_format "{{.query}} {{.duration}}" .',
  },
];

export const RANGE_VEC_FUNCTIONS = [
  {
    insertText: 'avg_over_time',
    label: 'avg_over_time',
    detail: 'avg_over_time(range-vector)',
    documentation: 'The average of all values in the specified interval.',
  },
  {
    insertText: 'bytes_over_time',
    label: 'bytes_over_time',
    detail: 'bytes_over_time(range-vector)',
    documentation: 'Counts the amount of bytes used by each log stream for a given range',
  },
  {
    insertText: 'bytes_rate',
    label: 'bytes_rate',
    detail: 'bytes_rate(range-vector)',
    documentation: 'Calculates the number of bytes per second for each stream.',
  },
  {
    insertText: 'first_over_time',
    label: 'first_over_time',
    detail: 'first_over_time(range-vector)',
    documentation: 'The first of all values in the specified interval. Only available in Loki 2.3+.',
  },
  {
    insertText: 'last_over_time',
    label: 'last_over_time',
    detail: 'last_over_time(range-vector)',
    documentation: 'The last of all values in the specified interval. Only available in Loki 2.3+.',
  },
  {
    insertText: 'sum_over_time',
    label: 'sum_over_time',
    detail: 'sum_over_time(range-vector)',
    documentation: 'The sum of all values in the specified interval.',
  },
  {
    insertText: 'count_over_time',
    label: 'count_over_time',
    detail: 'count_over_time(range-vector)',
    documentation: 'The count of all values in the specified interval.',
  },
  {
    insertText: 'max_over_time',
    label: 'max_over_time',
    detail: 'max_over_time(range-vector)',
    documentation: 'The maximum of all values in the specified interval.',
  },
  {
    insertText: 'min_over_time',
    label: 'min_over_time',
    detail: 'min_over_time(range-vector)',
    documentation: 'The minimum of all values in the specified interval.',
  },
  {
    insertText: 'quantile_over_time',
    label: 'quantile_over_time',
    detail: 'quantile_over_time(scalar, range-vector)',
    documentation: 'The φ-quantile (0 ≤ φ ≤ 1) of the values in the specified interval.',
  },
  {
    insertText: 'rate',
    label: 'rate',
    detail: 'rate(v range-vector)',
    documentation: 'Calculates the number of entries per second.',
  },
  {
    insertText: 'stddev_over_time',
    label: 'stddev_over_time',
    detail: 'stddev_over_time(range-vector)',
    documentation: 'The population standard deviation of the values in the specified interval.',
  },
  {
    insertText: 'stdvar_over_time',
    label: 'stdvar_over_time',
    detail: 'stdvar_over_time(range-vector)',
    documentation: 'The population standard variance of the values in the specified interval.',
  },
];

export const FUNCTIONS = [...AGGREGATION_OPERATORS, ...RANGE_VEC_FUNCTIONS];
export const LOKI_KEYWORDS = [...FUNCTIONS, ...PIPE_OPERATORS, ...PIPE_PARSERS].map((keyword) => keyword.label);

export const lokiGrammar: Grammar = {
  comment: {
    pattern: /#.*/,
  },
  'context-aggregation': {
    pattern: /((without|by)\s*)\([^)]*\)/, // by ()
    lookbehind: true,
    inside: {
      'label-key': {
        pattern: /[^(),\s][^,)]*[^),\s]*/,
        alias: 'attr-name',
      },
      punctuation: /[()]/,
    },
  },
  'context-labels': {
    pattern: /\{[^}]*(?=}?)/,
    greedy: true,
    inside: {
      comment: {
        pattern: /#.*/,
      },
      'label-key': {
        pattern: /[a-zA-Z_]\w*(?=\s*(=|!=|=~|!~))/,
        alias: 'attr-name',
        greedy: true,
      },
      'label-value': {
        pattern: /"(?:\\.|[^\\"])*"/,
        greedy: true,
        alias: 'attr-value',
      },
      punctuation: /[{]/,
    },
  },
  'context-pipe': {
    pattern: /\s\|[^=~]\s?\w*/i,
    inside: {
      'pipe-operator': {
        pattern: /\|/i,
        alias: 'operator',
      },
      'pipe-operations': {
        pattern: new RegExp(`${[...PIPE_PARSERS, ...PIPE_OPERATORS].map((f) => f.label).join('|')}`, 'i'),
        alias: 'keyword',
      },
    },
  },
  function: new RegExp(`\\b(?:${FUNCTIONS.map((f) => f.label).join('|')})(?=\\s*\\()`, 'i'),
  'context-range': [
    {
      pattern: /\[[^\]]*(?=\])/, // [1m]
      inside: {
        'range-duration': {
          pattern: /\b\d+[smhdwy]\b/i,
          alias: 'number',
        },
      },
    },
    {
      pattern: /(offset\s+)\w+/, // offset 1m
      lookbehind: true,
      inside: {
        'range-duration': {
          pattern: /\b\d+[smhdwy]\b/i,
          alias: 'number',
        },
      },
    },
  ],
  quote: {
    pattern: /"(?:\\.|[^\\"])*"/,
    alias: 'string',
    greedy: true,
  },
  backticks: {
    pattern: /`(?:\\.|[^\\`])*`/,
    alias: 'string',
    greedy: true,
  },
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  operator: /\s?(\|[=~]?|!=?|<(?:=>?|<|>)?|>[>=]?)\s?/i,
  punctuation: /[{}(),.]/,
};

export default lokiGrammar;
