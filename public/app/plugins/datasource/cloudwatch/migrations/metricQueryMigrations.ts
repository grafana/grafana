import { config } from '@grafana/runtime';

import { CloudWatchMetricsQuery } from '../types';

// Call this function to migrate queries from within the plugin.
export function migrateMetricQuery(query: CloudWatchMetricsQuery): CloudWatchMetricsQuery {
  //add metric query migrations here
  const migratedQuery = migrateAliasPatterns(query);
  return migratedQuery;
}

const aliasPatterns: Record<string, string> = {
  metric: `PROP('MetricName')`,
  namespace: `PROP('Namespace')`,
  period: `PROP('Period')`,
  region: `PROP('Region')`,
  stat: `PROP('Stat')`,
  label: `LABEL`,
};

export function migrateAliasPatterns(query: CloudWatchMetricsQuery): CloudWatchMetricsQuery {
  if (config.featureToggles.cloudWatchDynamicLabels && !query.hasOwnProperty('label')) {
    const regex = /{{\s*(.+?)\s*}}/g;
    query.label =
      query.alias?.replace(regex, (_, value) => {
        if (aliasPatterns.hasOwnProperty(value)) {
          return `\${${aliasPatterns[value]}}`;
        }

        return `\${PROP('Dim.${value}')}`;
      }) ?? '';
  }

  return query;
}
