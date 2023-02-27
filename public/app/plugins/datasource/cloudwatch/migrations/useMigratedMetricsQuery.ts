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
  const migratedQUery = useMemo(() => migrateMetricQuery(query), [query]);

  useEffect(() => {
    if (migratedQUery !== query) {
      onChangeQuery(migratedQUery);
    }
  }, [migratedQUery, query, onChangeQuery]);

  return migratedQUery;
};

export default useMigratedMetricsQuery;
