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
