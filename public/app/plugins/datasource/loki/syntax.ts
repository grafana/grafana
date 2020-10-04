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

export const PARSERS: CompletionItem[] = [
  {
    label: 'json',
    insertText: 'json',
    documentation: 'Extracting labels from the log line using json parser.',
  },
  {
    label: 'regexp',
    insertText: 'regexp',
    documentation: 'Extracting labels from the log line using regexp parser.',
  },
  {
    label: 'logfmt',
    insertText: 'logfmt',
    documentation: 'Extracting labels from the log line using logfmt parser.',
  },
];

export const OPERATORS: CompletionItem[] = [
  {
    label: 'filter_op',
    insertText: 'filter_op',
    documentation: '',
  },
  {
    label: 'label_filter',
    insertText: ' label_filter',
    documentation: '',
  },
  {
    label: 'label_format',
    insertText: ' label_format',
    documentation: '',
  },
  {
    label: ' line_format',
    insertText: '  line_format',
    documentation: '',
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
    insertText: 'min_over_time',
    label: 'min_over_time',
    detail: 'min_over_time(range-vector)',
    documentation: 'The minimum of all values in the specified interval.',
  },
  {
    insertText: 'max_over_time',
    label: 'max_over_time',
    detail: 'max_over_time(range-vector)',
    documentation: 'The maximum of all values in the specified interval.',
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
  function: new RegExp(`\\b(?:${FUNCTIONS.map(f => f.label).join('|')})(?=\\s*\\()`, 'i'),
  parser: {
    pattern: new RegExp(`\(?<=\|\\s?)${[...PARSERS, ...OPERATORS].map(f => f.label).join('|')}`, 'i'),
    alias: 'keyword',
  },
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
