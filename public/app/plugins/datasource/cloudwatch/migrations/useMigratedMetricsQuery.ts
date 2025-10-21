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
  const migratedQuery = useMemo(() => migrateMetricQuery(query), [query]);

  useEffect(() => {
    if (migratedQuery !== query) {
      onChangeQuery(migratedQuery);
    }
  }, [migratedQuery, query, onChangeQuery]);

  return migratedQuery;
};

export default useMigratedMetricsQuery;
