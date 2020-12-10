import { Grammar } from 'prismjs';
import { CompletionItem } from '@grafana/ui';

const AGGREGATION_OPERATORS: CompletionItem[] = [
  {
    label: 'sum',
    insertText: 'sum',
    documentation: 'Calculate sum over dimensions',
  },
  {
    label: 'min',
    insertText: 'min',
    documentation: 'Select minimum over dimensions',
  },
  {
    label: 'max',
    insertText: 'max',
    documentation: 'Select maximum over dimensions',
  },
  {
    label: 'avg',
    insertText: 'avg',
    documentation: 'Calculate the average over dimensions',
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
    label: 'count',
    insertText: 'count',
    documentation: 'Count number of elements in the vector',
  },
  {
    label: 'bottomk',
    insertText: 'bottomk',
    documentation: 'Smallest k elements by sample value',
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
    documentation: 'Extracting labels from the log line using json parser. Only available in Loki 2.0+.',
  },
  {
    label: 'regexp',
    insertText: 'regexp ""',
    documentation: 'Extracting labels from the log line using regexp parser. Only available in Loki 2.0+.',
    move: -1,
  },
  {
    label: 'logfmt',
    insertText: 'logfmt',
    documentation: 'Extracting labels from the log line using logfmt parser. Only available in Loki 2.0+.',
  },
];

export const PIPE_OPERATORS: CompletionItem[] = [
  {
    label: 'unwrap',
    insertText: 'unwrap',
    detail: 'unwrap identifier',
    documentation:
      'Take labels and use the values as sample data for metric aggregations. Only available in Loki 2.0+.',
  },
  {
    label: 'label_format',
    insertText: 'label_format',
    documentation: 'Only available in Loki 2.0+.',
  },
  {
    label: 'line_format',
    insertText: 'line_format',
    documentation: 'Only available in Loki 2.0+.',
  },
];

export const RANGE_VEC_FUNCTIONS = [
  {
    insertText: 'avg_over_time',
    label: 'avg_over_time',
    detail: 'avg_over_time(range-vector)',
    documentation: 'The average of all values in the specified interval. Only available in Loki 2.0+.',
  },
  {
    insertText: 'min_over_time',
    label: 'min_over_time',
    detail: 'min_over_time(range-vector)',
    documentation: 'The minimum of all values in the specified interval. Only available in Loki 2.0+.',
  },
  {
    insertText: 'max_over_time',
    label: 'max_over_time',
    detail: 'max_over_time(range-vector)',
    documentation: 'The maximum of all values in the specified interval. Only available in Loki 2.0+.',
  },
  {
    insertText: 'sum_over_time',
    label: 'sum_over_time',
    detail: 'sum_over_time(range-vector)',
    documentation: 'The sum of all values in the specified interval. Only available in Loki 2.0+.',
  },
  {
    insertText: 'count_over_time',
    label: 'count_over_time',
    detail: 'count_over_time(range-vector)',
    documentation: 'The count of all values in the specified interval.',
  },
  {
    insertText: 'stdvar_over_time',
    label: 'stdvar_over_time',
    detail: 'stdvar_over_time(range-vector)',
    documentation:
      'The population standard variance of the values in the specified interval. Only available in Loki 2.0+.',
  },
  {
    insertText: 'stddev_over_time',
    label: 'stddev_over_time',
    detail: 'stddev_over_time(range-vector)',
    documentation:
      'The population standard deviation of the values in the specified interval. Only available in Loki 2.0+.',
  },
  {
    insertText: 'quantile_over_time',
    label: 'quantile_over_time',
    detail: 'quantile_over_time(scalar, range-vector)',
    documentation: 'The φ-quantile (0 ≤ φ ≤ 1) of the values in the specified interval. Only available in Loki 2.0+.',
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
    insertText: 'rate',
    label: 'rate',
    detail: 'rate(v range-vector)',
    documentation:
      "Calculates the per-second average rate of increase of the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. Also, the calculation extrapolates to the ends of the time range, allowing for missed scrapes or imperfect alignment of scrape cycles with the range's time period.",
  },
];

export const FUNCTIONS = [...AGGREGATION_OPERATORS, ...RANGE_VEC_FUNCTIONS];

const tokenizer: Grammar = {
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
        pattern: /[a-z_]\w*(?=\s*(=|!=|=~|!~))/,
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
        pattern: new RegExp(`${[...PIPE_PARSERS, ...PIPE_OPERATORS].map(f => f.label).join('|')}`, 'i'),
        alias: 'keyword',
      },
    },
  },
  function: new RegExp(`\\b(?:${FUNCTIONS.map(f => f.label).join('|')})(?=\\s*\\()`, 'i'),
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
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  operator: /\s?(\|[=~]?|!=?|<(?:=>?|<|>)?|>[>=]?)\s?/i,
  punctuation: /[{}()`,.]/,
};

export default tokenizer;
