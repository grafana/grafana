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

export interface PromVisualQueryBinary {
  operator: string;
  query: PromVisualQuery;
}

export enum PromVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  GroupBy = 'Group by',
  RateAndDeltas = 'Rates & counters',
  Functions = 'Misc functions',
  Math = 'Math',
}

export interface PromQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
}

export function getDefaultTestQuery() {
  const model: PromVisualQuery = {
    metric: 'counters_requests',
    labels: [{ label: 'app', op: '=~', value: 'backend' }],
    operations: [
      { id: 'rate', params: ['auto'] },
      { id: '__sum_by', params: ['job'] },
    ],
  };

  return model;
}
