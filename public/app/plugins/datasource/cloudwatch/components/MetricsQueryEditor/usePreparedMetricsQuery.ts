import deepEqual from 'fast-deep-equal';
import { useEffect, useMemo } from 'react';

import { migrateMetricQuery } from '../../migrations/metricQueryMigrations';
import { CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../../types';

export const DEFAULT_QUERY: Omit<CloudWatchMetricsQuery, 'refId'> = {
  queryMode: 'Metrics',
  namespace: '',
  metricName: '',
  expression: '',
  dimensions: {},
  region: 'default',
  id: '',
  statistic: 'Average',
  period: '',
  metricQueryType: MetricQueryType.Search,
  metricEditorMode: MetricEditorMode.Builder,
  sqlExpression: '',
  matchExact: true,
};

const prepareQuery = (query: CloudWatchMetricsQuery) => {
  const withDefaults = { ...DEFAULT_QUERY, ...query };
  const migratedQuery = migrateMetricQuery(withDefaults);

  // If we didn't make any changes to the object, then return the original object to keep the
  // identity the same, and not trigger any other useEffects or anything.
  return deepEqual(migratedQuery, query) ? query : migratedQuery;
};

/**
 * Returns queries with some defaults + migrations, and calls onChange function to notify if it changes
 */
const usePreparedMetricsQuery = (
  query: CloudWatchMetricsQuery,
  onChangeQuery: (newQuery: CloudWatchMetricsQuery) => void
) => {
  const preparedQuery = useMemo(() => prepareQuery(query), [query]);

  useEffect(() => {
    if (preparedQuery !== query) {
      onChangeQuery(preparedQuery);
    }
  }, [preparedQuery, query, onChangeQuery]);

  return preparedQuery;
};

export default usePreparedMetricsQuery;
