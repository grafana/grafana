import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../types';

export interface PromLokiVisualQuery {
  metric?: string;
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
}

export interface VisualQueryBinary {
  operator: string;
  vectorMatches?: string;
  query: PromLokiVisualQuery;
}
