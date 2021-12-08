import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../../prometheus/querybuilder/shared/types';

/**
 * Visual query model
 */
export interface LokiVisualQuery {
  labels: QueryBuilderLabelFilter[];
  search?: string;
  operations: QueryBuilderOperation[];
  binaryQueries?: LokiVisualQueryBinary[];
}

export interface LokiVisualQueryBinary {
  operator: string;
  vectorMatches?: string;
  query: LokiVisualQuery;
}

export enum LokiVisualQueryOperationCategory {
  Aggregations = 'Aggregations',
  Functions = 'Functions',
  Formats = 'Formats',
  PipelineErrors = 'Pipeline errors',
}

export function getDefaultTestQuery() {
  const model: LokiVisualQuery = {
    labels: [
      { label: 'cluster', op: '=~', value: '$cluster' },
      { label: 'job', op: '=~', value: '($namespace)/query-scheduler.*' },
    ],
    operations: [],
  };

  return model;
}
