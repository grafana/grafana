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
  vectorMatches?: string;
  query: PromVisualQuery;
}

export enum PromVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  RateAndDeltas = 'Rate and counters',
  Functions = 'Functions',
  Math = 'Math',
}

export interface PromQueryPattern {
  name: string;
  operations: QueryBuilderOperation[];
}

export function getDefaultTestQuery() {
  const model: PromVisualQuery = {
    metric: '',
    labels: [],
    operations: [
      { id: 'rate', params: ['auto'] },
      { id: '__sum_by', params: ['job'] },
    ],
  };

  return model;
}
