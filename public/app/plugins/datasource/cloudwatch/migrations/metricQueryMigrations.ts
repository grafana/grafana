import deepEqual from 'fast-deep-equal';

import { CloudWatchMetricsQuery } from '../types';

// Call this function to migrate queries from within the plugin.
export function migrateMetricQuery(query: CloudWatchMetricsQuery): CloudWatchMetricsQuery {
  //add metric query migrations here
  const migratedQuery = migrateAliasPatterns(query);
  return deepEqual(migratedQuery, query) ? query : migratedQuery;
}

const aliasPatterns: Record<string, string> = {
  metric: `PROP('MetricName')`,
  namespace: `PROP('Namespace')`,
  period: `PROP('Period')`,
  region: `PROP('Region')`,
  stat: `PROP('Stat')`,
  label: `LABEL`,
};

// migrateAliasPatterns in the context of https://github.com/grafana/grafana/issues/48434
export function migrateAliasPatterns(query: CloudWatchMetricsQuery): CloudWatchMetricsQuery {
  if (!query.hasOwnProperty('label')) {
    const newQuery = { ...query };
    if (!query.hasOwnProperty('label')) {
      const regex = /{{\s*(.+?)\s*}}/g;
      newQuery.label =
        query.alias?.replace(regex, (_, value) => {
          if (aliasPatterns.hasOwnProperty(value)) {
            return `\${${aliasPatterns[value]}}`;
          }

          return `\${PROP('Dim.${value}')}`;
        }) ?? '';
    }
    return newQuery;
  }
  return query;
}
