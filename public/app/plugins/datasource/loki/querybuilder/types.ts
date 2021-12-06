import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../../prometheus/querybuilder/shared/types';

/**
 * Visual query model
 */
export interface LokiVisualQuery {
  labels: QueryBuilderLabelFilter[];
  operations: QueryBuilderOperation[];
}

export function getDefaultTestQuery() {
  const model: LokiVisualQuery = {
    labels: [
      { label: 'cluster', op: '=~', value: '$cluster' },
      { label: 'job', op: '=~', value: '($namespace)/query-scheduler.*' },
    ],
    operations: [
      { id: 'rate', params: ['auto'] },
      { id: '__group_by', params: ['sum', 'job'] },
    ],
  };

  return model;
}
