import { CoreApp } from '@grafana/data';
import { PromQuery } from '../types';
import { VisualQueryBinary } from './shared/LokiAndPromQueryModellerBase';
import { QueryBuilderLabelFilter, QueryBuilderOperation, QueryEditorMode } from './shared/types';

/**
 * Visual query model
 */
export interface PromVisualQuery {
  metric: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
  binaryQueries?: PromVisualQueryBinary[];
}

export type PromVisualQueryBinary = VisualQueryBinary<PromVisualQuery>;

export enum PromVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  RangeFunctions = 'Range functions',
  Functions = 'Functions',
  BinaryOps = 'Binary operations',
}

export enum PromOperationId {
  HistogramQuantile = 'histogram_quantile',
  LabelReplace = 'label_replace',
  Ln = 'ln',
  Changes = 'changes',
  Rate = 'rate',
  Irate = 'irate',
  Increase = 'increase',
  Delta = 'delta',
  MultiplyBy = '__multiply_by',
  DivideBy = '__divide_by',
  NestedQuery = '__nested_query',
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  Topk = 'topk',
  SumOverTime = 'sum_over_time',
  AvgOverTime = 'avg_over_time',
  MinOverTime = 'min_over_time',
  MaxOverTime = 'max_over_time',
  CountOverTime = 'count_over_time',
  LastOverTime = 'last_over_time',
  PresentOverTime = 'present_over_time',
  StddevOverTime = 'stddev_over_time',
  StdvarOverTime = 'stdvar_over_time',
}

export interface PromQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
}

/**
 * Returns query with defaults, and boolean true/false depending on change was required
 */
export function getQueryWithDefaults(query: PromQuery, app: CoreApp | undefined): PromQuery {
  // If no expr (ie new query) then default to builder
  let result = query;
  const editorMode = query.editorMode ?? (query.expr ? QueryEditorMode.Code : QueryEditorMode.Builder);

  if (result.editorMode !== editorMode) {
    result = { ...result, editorMode };
  }

  if (query.expr == null) {
    result = { ...result, expr: '' };
  }

  // Default to range query
  if (query.range == null) {
    result = { ...result, range: true };
  }

  // In explore we default to both instant & range
  if (query.instant == null && query.range == null) {
    if (app === CoreApp.Explore) {
      result = { ...result, instant: true };
    } else {
      result = { ...result, instant: false, range: true };
    }
  }

  return result;
}
