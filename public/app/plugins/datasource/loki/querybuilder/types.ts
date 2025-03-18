import {
  VisualQueryBinary,
  QueryBuilderLabelFilter,
  QueryBuilderOperation,
  BINARY_OPERATIONS_KEY,
} from '@grafana/experimental';

/**
 * Visual query model
 */
export interface LokiVisualQuery {
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: LokiVisualQueryBinary[];
}

export type LokiVisualQueryBinary = VisualQueryBinary<LokiVisualQuery>;
export enum LokiQueryPatternType {
  Log = 'log',
  Metric = 'metric',
}

export interface LokiQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
  type: LokiQueryPatternType;
}

export enum LokiVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  RangeFunctions = 'Range functions',
  Functions = 'Functions',
  Formats = 'Formats',
  LineFilters = 'Line filters',
  LabelFilters = 'Label filters',
  BinaryOps = `${BINARY_OPERATIONS_KEY}`,
}

export enum LokiOperationId {
  Json = 'json',
  Logfmt = 'logfmt',
  Regexp = 'regexp',
  Pattern = 'pattern',
  Unpack = 'unpack',
  LineFormat = 'line_format',
  LabelFormat = 'label_format',
  Decolorize = 'decolorize',
  Drop = 'drop',
  Keep = 'keep',
  Rate = 'rate',
  RateCounter = 'rate_counter',
  CountOverTime = 'count_over_time',
  SumOverTime = 'sum_over_time',
  AvgOverTime = 'avg_over_time',
  MaxOverTime = 'max_over_time',
  MinOverTime = 'min_over_time',
  FirstOverTime = 'first_over_time',
  LastOverTime = 'last_over_time',
  StdvarOverTime = 'stdvar_over_time',
  StddevOverTime = 'stddev_over_time',
  QuantileOverTime = 'quantile_over_time',
  BytesRate = 'bytes_rate',
  BytesOverTime = 'bytes_over_time',
  AbsentOverTime = 'absent_over_time',
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  Stddev = 'stddev',
  Stdvar = 'stdvar',
  Count = 'count',
  TopK = 'topk',
  BottomK = 'bottomk',
  LineContains = '__line_contains',
  LineContainsNot = '__line_contains_not',
  LineContainsCaseInsensitive = '__line_contains_case_insensitive',
  LineContainsNotCaseInsensitive = '__line_contains_not_case_insensitive',
  LineMatchesRegex = '__line_matches_regex',
  LineMatchesRegexNot = '__line_matches_regex_not',
  LineFilterIpMatches = '__line_filter_ip_matches',
  LabelFilter = '__label_filter',
  LabelFilterNoErrors = '__label_filter_no_errors',
  LabelFilterIpMatches = '__label_filter_ip_marches',
  Unwrap = 'unwrap',
  SumBy = '__sum_by',
  SumWithout = '__sum_without',
  // Binary ops
  Addition = '__addition',
  Subtraction = '__subtraction',
  MultiplyBy = '__multiply_by',
  DivideBy = '__divide_by',
  Modulo = '__modulo',
  Exponent = '__exponent',
  NestedQuery = '__nested_query',
  EqualTo = '__equal_to',
  NotEqualTo = '__not_equal_to',
  GreaterThan = '__greater_than',
  LessThan = '__less_than',
  GreaterOrEqual = '__greater_or_equal',
  LessOrEqual = '__less_or_equal',
}

export enum LokiOperationOrder {
  LineFilters = 1,
  Parsers = 2,
  PipeOperations = 3,
  // Unwrap is a special case, as it is usually the last operation, so the order is after pipeOperations
  Unwrap = 4,
  NoErrors = 5,
  RangeVectorFunction = 5,
  Last = 6,
}

export const lokiOperators = {
  equals: { label: '=', value: '=', description: 'Equals', isMultiValue: false },
  doesNotEqual: { label: '!=', value: '!=', description: 'Does not equal', isMultiValue: false },
  matchesRegex: { label: '=~', value: '=~', description: 'Matches regex', isMultiValue: true },
  doesNotMatchRegex: { label: '!~', value: '!~', description: 'Does not match regex', isMultiValue: true },
  greaterThan: { label: '>', value: '>', description: 'Greater than', isMultiValue: false },
  greaterThanOrEqual: { label: '>=', value: '>=', description: 'Greater than or equal to', isMultiValue: false },
  lessThan: { label: '<', value: '<', description: 'Less than', isMultiValue: false },
  lessThanOrEqual: { label: '<=', value: '<=', description: 'Less than or equal to', isMultiValue: false },
  contains: { label: '|=', value: '|=', description: 'Contains', isMultiValue: false },
  doesNotContain: { label: '!=', value: '!=', description: 'Does not contain', isMultiValue: false },
};
