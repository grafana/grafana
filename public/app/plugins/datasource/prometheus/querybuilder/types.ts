import { VisualQueryBinary } from './shared/LokiAndPromQueryModellerBase';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from './shared/types';

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

export function getDefaultEmptyQuery() {
  const model: PromVisualQuery = {
    metric: '',
    labels: [],
    operations: [],
  };

  return model;
}
