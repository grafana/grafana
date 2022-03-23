import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../../prometheus/querybuilder/shared/types';

/**
 * Visual query model
 */
export interface LokiVisualQuery {
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: LokiVisualQueryBinary[];
}

export interface LokiVisualQueryBinary {
  operator: string;
  vectorMatches?: string;
  query: LokiVisualQuery;
}
export interface LokiQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
}

export enum LokiVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  RangeFunctions = 'Range functions',
  Functions = 'Functions',
  Formats = 'Formats',
  LineFilters = 'Line filters',
  LabelFilters = 'Label filters',
}

export enum LokiOperationId {
  Json = 'json',
  Logfmt = 'logfmt',
  Rate = 'rate',
  CountOverTime = 'count_over_time',
  SumOverTime = 'sum_over_time',
  BytesRate = 'bytes_rate',
  BytesOverTime = 'bytes_over_time',
  AbsentOverTime = 'absent_over_time',
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  LineContains = '__line_contains',
  LineContainsNot = '__line_contains_not',
  LineMatchesRegex = '__line_matches_regex',
  LineMatchesRegexNot = '__line_matches_regex_not',
  LabelFilter = '__label_filter',
  LabelFilterNoErrors = '__label_filter_no_errors',
  Unwrap = 'unwrap',
}

export enum LokiOperationOrder {
  LineFilters = 1,
  LineFormats = 2,
  LabelFilters = 3,
  Unwrap = 4,
  NoErrors = 5,
  RangeVectorFunction = 5,
  Last = 6,
}

export function getDefaultEmptyQuery(): LokiVisualQuery {
  return {
    labels: [],
    operations: [{ id: '__line_contains', params: [''] }],
  };
}
