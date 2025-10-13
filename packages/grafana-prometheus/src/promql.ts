// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/promql.ts
import { Grammar } from 'prismjs';

import { CompletionItem } from '@grafana/ui';

// When changing RATE_RANGES, check if Loki/LogQL ranges should be changed too
// @see public/app/plugins/datasource/loki/LanguageProvider.ts
export const RATE_RANGES: CompletionItem[] = [
  { label: '$__interval', sortValue: '$__interval' },
  { label: '$__rate_interval', sortValue: '$__rate_interval' },
  { label: '$__range', sortValue: '$__range' },
  { label: '1m', sortValue: '00:01:00' },
  { label: '5m', sortValue: '00:05:00' },
  { label: '10m', sortValue: '00:10:00' },
  { label: '30m', sortValue: '00:30:00' },
  { label: '1h', sortValue: '01:00:00' },
  { label: '1d', sortValue: '24:00:00' },
];

export const OPERATORS = ['by', 'group_left', 'group_right', 'ignoring', 'on', 'offset', 'without'];
export const LOGICAL_OPERATORS = ['or', 'and', 'unless'];

const TRIGONOMETRIC_FUNCTIONS: CompletionItem[] = [
  {
    label: 'acos',
    insertText: 'acos',
    detail: 'acos(v instant-vector)',
    documentation: 'calculates the arccosine of all elements in v',
  },
  {
    label: 'acosh',
    insertText: 'acosh',
    detail: 'acosh(v instant-vector)',
    documentation: 'calculates the inverse hyperbolic cosine of all elements in v',
  },
  {
    label: 'asin',
    insertText: 'asin',
    detail: 'asin(v instant-vector)',
    documentation: 'calculates the arcsine of all elements in v',
  },
  {
    label: 'asinh',
    insertText: 'asinh',
    detail: 'asinh(v instant-vector)',
    documentation: 'calculates the inverse hyperbolic sine of all elements in v',
  },
  {
    label: 'atan',
    insertText: 'atan',
    detail: 'atan(v instant-vector)',
    documentation: 'calculates the arctangent of all elements in v',
  },
  {
    label: 'atanh',
    insertText: 'atanh',
    detail: 'atanh(v instant-vector)',
    documentation: 'calculates the inverse hyperbolic tangent of all elements in v',
  },
  {
    label: 'cos',
    insertText: 'cos',
    detail: 'cos(v instant-vector)',
    documentation: 'calculates the cosine of all elements in v',
  },
  {
    label: 'cosh',
    insertText: 'cosh',
    detail: 'cosh(v instant-vector)',
    documentation: 'calculates the hyperbolic cosine of all elements in v',
  },
  {
    label: 'sin',
    insertText: 'sin',
    detail: 'sin(v instant-vector)',
    documentation: 'calculates the sine of all elements in v',
  },
  {
    label: 'sinh',
    insertText: 'sinh',
    detail: 'sinh(v instant-vector)',
    documentation: 'calculates the hyperbolic sine of all elements in v',
  },
  {
    label: 'tan',
    insertText: 'tan',
    detail: 'tan(v instant-vector)',
    documentation: 'calculates the tangent of all elements in v',
  },
  {
    label: 'tanh',
    insertText: 'tanh',
    detail: 'tanh(v instant-vector)',
    documentation: 'calculates the hyperbolic tangent of all elements in v',
  },
];

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
    label: 'group',
    insertText: 'group',
    documentation: 'All values in the resulting vector are 1',
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
    label: 'count_values',
    insertText: 'count_values',
    documentation: 'Count number of elements with the same value',
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
  {
    label: 'quantile',
    insertText: 'quantile',
    documentation: 'Calculate φ-quantile (0 ≤ φ ≤ 1) over dimensions',
  },
];

export const FUNCTIONS = [
  ...AGGREGATION_OPERATORS,
  ...TRIGONOMETRIC_FUNCTIONS,
  {
    insertText: 'abs',
    label: 'abs',
    detail: 'abs(v instant-vector)',
    documentation: 'Returns the input vector with all sample values converted to their absolute value.',
  },
  {
    insertText: 'absent',
    label: 'absent',
    detail: 'absent(v instant-vector)',
    documentation:
      'Returns an empty vector if the vector passed to it has any elements and a 1-element vector with the value 1 if the vector passed to it has no elements. This is useful for alerting on when no time series exist for a given metric name and label combination.',
  },
  {
    insertText: 'absent_over_time',
    label: 'absent_over_time',
    detail: 'absent(v range-vector)',
    documentation:
      'Returns an empty vector if the range vector passed to it has any elements and a 1-element vector with the value 1 if the range vector passed to it has no elements.',
  },
  {
    insertText: 'ceil',
    label: 'ceil',
    detail: 'ceil(v instant-vector)',
    documentation: 'Rounds the sample values of all elements in `v` up to the nearest integer.',
  },
  {
    insertText: 'changes',
    label: 'changes',
    detail: 'changes(v range-vector)',
    documentation:
      'For each input time series, `changes(v range-vector)` returns the number of times its value has changed within the provided time range as an instant vector.',
  },
  {
    insertText: 'clamp',
    label: 'clamp',
    detail: 'clamp(v instant-vector, min scalar, max scalar)',
    documentation:
      'Clamps the sample values of all elements in `v` to have a lower limit of `min` and an upper limit of `max`.',
  },
  {
    insertText: 'clamp_max',
    label: 'clamp_max',
    detail: 'clamp_max(v instant-vector, max scalar)',
    documentation: 'Clamps the sample values of all elements in `v` to have an upper limit of `max`.',
  },
  {
    insertText: 'clamp_min',
    label: 'clamp_min',
    detail: 'clamp_min(v instant-vector, min scalar)',
    documentation: 'Clamps the sample values of all elements in `v` to have a lower limit of `min`.',
  },
  {
    insertText: 'count_scalar',
    label: 'count_scalar',
    detail: 'count_scalar(v instant-vector)',
    documentation:
      'Returns the number of elements in a time series vector as a scalar. This is in contrast to the `count()` aggregation operator, which always returns a vector (an empty one if the input vector is empty) and allows grouping by labels via a `by` clause.',
  },
  {
    insertText: 'deg',
    label: 'deg',
    detail: 'deg(v instant-vector)',
    documentation: 'Converts radians to degrees for all elements in v',
  },
  {
    insertText: 'day_of_month',
    label: 'day_of_month',
    detail: 'day_of_month(v=vector(time()) instant-vector)',
    documentation: 'Returns the day of the month for each of the given times in UTC. Returned values are from 1 to 31.',
  },
  {
    insertText: 'day_of_week',
    label: 'day_of_week',
    detail: 'day_of_week(v=vector(time()) instant-vector)',
    documentation:
      'Returns the day of the week for each of the given times in UTC. Returned values are from 0 to 6, where 0 means Sunday etc.',
  },
  {
    insertText: 'day_of_year',
    label: 'day_of_year',
    detail: 'day_of_year(v=vector(time()) instant-vector)',
    documentation:
      'Returns the day of the year for each of the given times in UTC. Returned values are from 1 to 365 for non-leap years, and 1 to 366 in leap years.',
  },
  {
    insertText: 'days_in_month',
    label: 'days_in_month',
    detail: 'days_in_month(v=vector(time()) instant-vector)',
    documentation:
      'Returns number of days in the month for each of the given times in UTC. Returned values are from 28 to 31.',
  },
  {
    insertText: 'delta',
    label: 'delta',
    detail: 'delta(v range-vector)',
    documentation:
      'Calculates the difference between the first and last value of each time series element in a range vector `v`, returning an instant vector with the given deltas and equivalent labels. The delta is extrapolated to cover the full time range as specified in the range vector selector, so that it is possible to get a non-integer result even if the sample values are all integers.',
  },
  {
    insertText: 'deriv',
    label: 'deriv',
    detail: 'deriv(v range-vector)',
    documentation:
      'Calculates the per-second derivative of the time series in a range vector `v`, using simple linear regression.',
  },
  {
    insertText: 'double_exponential_smoothing',
    label: 'double_exponential_smoothing',
    detail: 'double_exponential_smoothing(v range-vector, sf scalar, tf scalar)',
    documentation:
      'Produces a smoothed value for time series based on the range in `v`. The lower the smoothing factor `sf`, the more importance is given to old data. The higher the trend factor `tf`, the more trends in the data is considered. Both `sf` and `tf` must be between 0 and 1.',
  },
  {
    insertText: 'drop_common_labels',
    label: 'drop_common_labels',
    detail: 'drop_common_labels(instant-vector)',
    documentation: 'Drops all labels that have the same name and value across all series in the input vector.',
  },
  {
    insertText: 'exp',
    label: 'exp',
    detail: 'exp(v instant-vector)',
    documentation:
      'Calculates the exponential function for all elements in `v`.\nSpecial cases are:\n* `Exp(+Inf) = +Inf` \n* `Exp(NaN) = NaN`',
  },
  {
    insertText: 'floor',
    label: 'floor',
    detail: 'floor(v instant-vector)',
    documentation: 'Rounds the sample values of all elements in `v` down to the nearest integer.',
  },
  {
    insertText: 'histogram_quantile',
    label: 'histogram_quantile',
    detail: 'histogram_quantile(φ float, b instant-vector)',
    documentation:
      'Calculates the φ-quantile (0 ≤ φ ≤ 1) from the buckets `b` of a histogram. The samples in `b` are the counts of observations in each bucket. Each sample must have a label `le` where the label value denotes the inclusive upper bound of the bucket. (Samples without such a label are silently ignored.) The histogram metric type automatically provides time series with the `_bucket` suffix and the appropriate labels.',
  },
  {
    insertText: 'holt_winters',
    label: 'holt_winters',
    detail: 'holt_winters(v range-vector, sf scalar, tf scalar)',
    documentation:
      'Renamed as double_exponential_smoothing in prometheus v3.x. For prometheus versions equal and greater than v3.0 please use double_exponential_smoothing. \n\nProduces a smoothed value for time series based on the range in `v`. The lower the smoothing factor `sf`, the more importance is given to old data. The higher the trend factor `tf`, the more trends in the data is considered. Both `sf` and `tf` must be between 0 and 1.',
  },
  {
    insertText: 'hour',
    label: 'hour',
    detail: 'hour(v=vector(time()) instant-vector)',
    documentation: 'Returns the hour of the day for each of the given times in UTC. Returned values are from 0 to 23.',
  },
  {
    insertText: 'idelta',
    label: 'idelta',
    detail: 'idelta(v range-vector)',
    documentation:
      'Calculates the difference between the last two samples in the range vector `v`, returning an instant vector with the given deltas and equivalent labels.',
  },
  {
    insertText: 'increase',
    label: 'increase',
    detail: 'increase(v range-vector)',
    documentation:
      'Calculates the increase in the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. The increase is extrapolated to cover the full time range as specified in the range vector selector, so that it is possible to get a non-integer result even if a counter increases only by integer increments.',
  },
  {
    insertText: 'irate',
    label: 'irate',
    detail: 'irate(v range-vector)',
    documentation:
      'Calculates the per-second instant rate of increase of the time series in the range vector. This is based on the last two data points. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for.',
  },
  {
    insertText: 'label_join',
    label: 'label_join',
    detail:
      'label_join(v instant-vector, dst_label string, separator string, src_label_1 string, src_label_2 string, ...)',
    documentation:
      'For each timeseries in `v`, joins all the values of all the `src_labels` using `separator` and returns the timeseries with the label `dst_label` containing the joined value. There can be any number of `src_labels` in this function.',
  },
  {
    insertText: 'label_replace',
    label: 'label_replace',
    detail: 'label_replace(v instant-vector, dst_label string, replacement string, src_label string, regex string)',
    documentation:
      "For each timeseries in `v`, `label_replace(v instant-vector, dst_label string, replacement string, src_label string, regex string)`  matches the regular expression `regex` against the label `src_label`.  If it matches, then the timeseries is returned with the label `dst_label` replaced by the expansion of `replacement`. `$1` is replaced with the first matching subgroup, `$2` with the second etc. If the regular expression doesn't match then the timeseries is returned unchanged.",
  },
  {
    insertText: 'ln',
    label: 'ln',
    detail: 'ln(v instant-vector)',
    documentation:
      'Calculates the natural logarithm for all elements in `v`.\nSpecial cases are:\n * `ln(+Inf) = +Inf`\n * `ln(0) = -Inf`\n * `ln(x < 0) = NaN`\n * `ln(NaN) = NaN`',
  },
  {
    insertText: 'log2',
    label: 'log2',
    detail: 'log2(v instant-vector)',
    documentation:
      'Calculates the binary logarithm for all elements in `v`. The special cases are equivalent to those in `ln`.',
  },
  {
    insertText: 'log10',
    label: 'log10',
    detail: 'log10(v instant-vector)',
    documentation:
      'Calculates the decimal logarithm for all elements in `v`. The special cases are equivalent to those in `ln`.',
  },
  {
    insertText: 'minute',
    label: 'minute',
    detail: 'minute(v=vector(time()) instant-vector)',
    documentation:
      'Returns the minute of the hour for each of the given times in UTC. Returned values are from 0 to 59.',
  },
  {
    insertText: 'month',
    label: 'month',
    detail: 'month(v=vector(time()) instant-vector)',
    documentation:
      'Returns the month of the year for each of the given times in UTC. Returned values are from 1 to 12, where 1 means January etc.',
  },
  {
    insertText: 'pi',
    label: 'pi',
    detail: 'pi()',
    documentation: 'Returns pi',
  },
  {
    insertText: 'predict_linear',
    label: 'predict_linear',
    detail: 'predict_linear(v range-vector, t scalar)',
    documentation:
      'Predicts the value of time series `t` seconds from now, based on the range vector `v`, using simple linear regression.',
  },
  {
    insertText: 'rad',
    label: 'rad',
    detail: 'rad(v instant-vector)',
    documentation: 'Converts degrees to radians for all elements in v',
  },
  {
    insertText: 'rate',
    label: 'rate',
    detail: 'rate(v range-vector)',
    documentation:
      "Calculates the per-second average rate of increase of the time series in the range vector. Breaks in monotonicity (such as counter resets due to target restarts) are automatically adjusted for. Also, the calculation extrapolates to the ends of the time range, allowing for missed scrapes or imperfect alignment of scrape cycles with the range's time period.",
  },
  {
    insertText: 'resets',
    label: 'resets',
    detail: 'resets(v range-vector)',
    documentation:
      'For each input time series, `resets(v range-vector)` returns the number of counter resets within the provided time range as an instant vector. Any decrease in the value between two consecutive samples is interpreted as a counter reset.',
  },
  {
    insertText: 'round',
    label: 'round',
    detail: 'round(v instant-vector, to_nearest=1 scalar)',
    documentation:
      'Rounds the sample values of all elements in `v` to the nearest integer. Ties are resolved by rounding up. The optional `to_nearest` argument allows specifying the nearest multiple to which the sample values should be rounded. This multiple may also be a fraction.',
  },
  {
    insertText: 'scalar',
    label: 'scalar',
    detail: 'scalar(v instant-vector)',
    documentation:
      'Given a single-element input vector, `scalar(v instant-vector)` returns the sample value of that single element as a scalar. If the input vector does not have exactly one element, `scalar` will return `NaN`.',
  },
  {
    insertText: 'sgn',
    label: 'sgn',
    detail: 'sgn(v instant-vector)',
    documentation:
      'Returns a vector with all sample values converted to their sign, defined as this: 1 if v is positive, -1 if v is negative and 0 if v is equal to zero.',
  },
  {
    insertText: 'sort',
    label: 'sort',
    detail: 'sort(v instant-vector)',
    documentation: 'Returns vector elements sorted by their sample values, in ascending order.',
  },
  {
    insertText: 'sort_desc',
    label: 'sort_desc',
    detail: 'sort_desc(v instant-vector)',
    documentation: 'Returns vector elements sorted by their sample values, in descending order.',
  },
  {
    insertText: 'sqrt',
    label: 'sqrt',
    detail: 'sqrt(v instant-vector)',
    documentation: 'Calculates the square root of all elements in `v`.',
  },
  {
    insertText: 'time',
    label: 'time',
    detail: 'time()',
    documentation:
      'Returns the number of seconds since January 1, 1970 UTC. Note that this does not actually return the current time, but the time at which the expression is to be evaluated.',
  },
  {
    insertText: 'timestamp',
    label: 'timestamp',
    detail: 'timestamp(v instant-vector)',
    documentation:
      'Returns the timestamp of each of the samples of the given vector as the number of seconds since January 1, 1970 UTC.',
  },
  {
    insertText: 'vector',
    label: 'vector',
    detail: 'vector(s scalar)',
    documentation: 'Returns the scalar `s` as a vector with no labels.',
  },
  {
    insertText: 'year',
    label: 'year',
    detail: 'year(v=vector(time()) instant-vector)',
    documentation: 'Returns the year for each of the given times in UTC.',
  },
  {
    insertText: 'avg_over_time',
    label: 'avg_over_time',
    detail: 'avg_over_time(range-vector)',
    documentation: 'The average value of all points in the specified interval.',
  },
  {
    insertText: 'min_over_time',
    label: 'min_over_time',
    detail: 'min_over_time(range-vector)',
    documentation: 'The minimum value of all points in the specified interval.',
  },
  {
    insertText: 'max_over_time',
    label: 'max_over_time',
    detail: 'max_over_time(range-vector)',
    documentation: 'The maximum value of all points in the specified interval.',
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
    insertText: 'quantile_over_time',
    label: 'quantile_over_time',
    detail: 'quantile_over_time(scalar, range-vector)',
    documentation: 'The φ-quantile (0 ≤ φ ≤ 1) of the values in the specified interval.',
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
  {
    insertText: 'last_over_time',
    label: 'last_over_time',
    detail: 'last_over_time(range-vector)',
    documentation: 'The most recent point value in specified interval.',
  },
  {
    insertText: 'present_over_time',
    label: 'present_over_time',
    detail: 'present_over_time(range-vector)',
    documentation: 'The value 1 for any series in the specified interval.',
  },
  {
    insertText: 'histogram_avg',
    label: 'histogram_avg',
    detail: 'histogram_avg(v instant-vector)',
    documentation:
      'Returns the arithmetic average of observed values stored in a native histogram. Samples that are not native histograms are ignored and do not show up in the returned vector.',
  },
  {
    insertText: 'histogram_count',
    label: 'histogram_count',
    detail: 'histogram_count(v instant-vector)',
    documentation: 'Returns the count of observations stored in a native histogram.',
  },
  {
    insertText: 'histogram_sum',
    label: 'histogram_sum',
    detail: 'histogram_sum(v instant-vector)',
    documentation: 'Returns the sum of observations stored in a native histogram.',
  },
  {
    insertText: 'histogram_fraction',
    label: 'histogram_fraction',
    detail: 'histogram_fraction(lower scalar, upper scalar, v instant-vector)',
    documentation: 'Returns the estimated fraction of observations between the provided lower and upper values.',
  },
  {
    insertText: 'histogram_stddev',
    label: 'histogram_stddev',
    detail: 'histogram_stddev(v instant-vector)',
    documentation:
      'Returns the estimated standard deviation of observations in a native histogram, based on the geometric mean of the buckets where the observations lie.',
  },
  {
    insertText: 'histogram_stdvar',
    label: 'histogram_stdvar',
    detail: 'histogram_stdvar(v instant-vector)',
    documentation: 'Returns the estimated standard variance of observations in a native histogram.',
  },
];

export const PROM_KEYWORDS = FUNCTIONS.map((keyword) => keyword.label);

export const promqlGrammar: Grammar = {
  comment: {
    pattern: /#.*/,
  },
  'context-aggregation': {
    pattern: /((by|without)\s*)\([^)]*\)/, // by ()
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
  function: new RegExp(`\\b(?:${FUNCTIONS.map((f) => f.label).join('|')})(?=\\s*\\()`, 'i'),
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
  idList: {
    pattern: /\d+(\|\d+)+/,
    alias: 'number',
  },
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  operator: new RegExp(`/[-+*/=%^~]|&&?|\\|?\\||!=?|<(?:=>?|<|>)?|>[>=]?|\\b(?:${OPERATORS.join('|')})\\b`, 'i'),
  punctuation: /[{};()`,.]/,
};

export default promqlGrammar;
