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
  Aggregations = 'Aggregations',
  RangeFunctions = 'Range functions',
  Functions = 'Functions',
  Formats = 'Formats',
  LineFilters = 'Line filters',
  LabelFilters = 'Label filters',
}

export function getDefaultEmptyQuery(): LokiVisualQuery {
  return {
    labels: [],
    operations: [{ id: '__line_contains', params: [''] }],
  };
}
