import { buildVisualQueryFromString, QueryBuilderLabelFilter } from '@grafana/prometheus';

import { isEquals } from './utils';

/** An identified metric and its label for a query */
export type QueryMetric = {
  metric: string;
  labelFilters: QueryBuilderLabelFilter[];
  query: string;
};

export function getQueryMetrics(queries: string[]) {
  const queryMetrics: QueryMetric[] = [];

  queries.forEach((query) => {
    const struct = buildVisualQueryFromString(query);
    if (struct.errors.length > 0) {
      return;
    }

    const { metric, labels } = struct.query;

    queryMetrics.push({ metric, labelFilters: labels.filter(isEquals), query });
    struct.query.binaryQueries?.forEach(({ query: { metric, labels } }) => {
      queryMetrics.push({ metric, labelFilters: labels.filter(isEquals), query });
    });
  });

  return queryMetrics;
}
