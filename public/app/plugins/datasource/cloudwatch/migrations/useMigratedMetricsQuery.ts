import { useEffect, useMemo } from 'react';

import { CloudWatchMetricsQuery } from '../types';

import { migrateMetricQuery } from './metricQueryMigrations';

/**
 * Returns queries with migrations, and calls onChange function to notify if it changes
 */
const useMigratedMetricsQuery = (
  query: CloudWatchMetricsQuery,
  onChangeQuery: (newQuery: CloudWatchMetricsQuery) => void
) => {
  const preparedQuery = useMemo(() => migrateMetricQuery(query), [query]);

  useEffect(() => {
    if (preparedQuery !== query) {
      onChangeQuery(preparedQuery);
    }
  }, [preparedQuery, query, onChangeQuery]);

  return preparedQuery;
};

export default useMigratedMetricsQuery;
