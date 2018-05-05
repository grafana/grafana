export const OPERATORS = ['by', 'group_left', 'group_right', 'ignoring', 'on', 'offset', 'without'];

const AGGREGATION_OPERATORS = [
  'sum',
  'min',
  'max',
  'avg',
  'stddev',
  'stdvar',
  'count',
  'count_values',
  'bottomk',
  'topk',
  'quantile',
];

export const FUNCTIONS = [
  ...AGGREGATION_OPERATORS,
  'abs',
  'absent',
  'ceil',
  'changes',
  'clamp_max',
  'clamp_min',
  'count_scalar',
  'day_of_month',
  'day_of_week',
  'days_in_month',
  'delta',
  'deriv',
  'drop_common_labels',
  'exp',
  'floor',
  'histogram_quantile',
  'holt_winters',
  'hour',
  'idelta',
  'increase',
  'irate',
  'label_replace',
  'ln',
  'log2',
  'log10',
  'minute',
  'month',
  'predict_linear',
  'rate',
  'resets',
  'round',
  'scalar',
  'sort',
  'sort_desc',
  'sqrt',
  'time',
  'vector',
  'year',
  'avg_over_time',
  'min_over_time',
  'max_over_time',
  'sum_over_time',
  'count_over_time',
  'quantile_over_time',
  'stddev_over_time',
  'stdvar_over_time',
];

const tokenizer = {
  comment: {
    pattern: /(^|[^\n])#.*/,
    lookbehind: true,
  },
  'context-aggregation': {
    pattern: /((by|without)\s*)\([^)]*\)/, // by ()
    lookbehind: true,
    inside: {
      'label-key': {
        pattern: /[^,\s][^,]*[^,\s]*/,
        alias: 'attr-name',
      },
    },
  },
  'context-labels': {
    pattern: /\{[^}]*(?=})/,
    inside: {
      'label-key': {
        pattern: /[a-z_]\w*(?=\s*(=|!=|=~|!~))/,
        alias: 'attr-name',
      },
      'label-value': {
        pattern: /"(?:\\.|[^\\"])*"/,
        greedy: true,
        alias: 'attr-value',
      },
    },
  },
  function: new RegExp(`\\b(?:${FUNCTIONS.join('|')})(?=\\s*\\()`, 'i'),
  'context-range': [
    {
      pattern: /\[[^\]]*(?=])/, // [1m]
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
  operator: new RegExp(`/[-+*/=%^~]|&&?|\\|?\\||!=?|<(?:=>?|<|>)?|>[>=]?|\\b(?:${OPERATORS.join('|')})\\b`, 'i'),
  punctuation: /[{};()`,.]/,
};

export default tokenizer;
