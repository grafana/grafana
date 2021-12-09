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

export enum LokiVisualQueryOperationCategory {
  Functions = 'Functions',
  Formats = 'Formats',
  PipelineErrors = 'Pipeline errors',
  LineFilters = 'Line filters',
}

export function getDefaultEmptyQuery(): LokiVisualQuery {
  return {
    labels: [],
    operations: [{ id: '__line_contains', params: [''] }],
  };
}
