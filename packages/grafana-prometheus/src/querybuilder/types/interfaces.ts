import { QueryBuilderLabelFilter } from '../shared/types';

export interface PromQueryModellerInterface {
  renderLabels(labels: QueryBuilderLabelFilter[]): string;
  renderQuery(query: string): string;
}

export interface QueryModeller {
  getQueryContext(): PromQueryModellerInterface;
}
