import { useEffect, useMemo } from 'react';

import { CloudWatchQuery } from '../types';

/**
 * Returns queries with migrations, and calls onChange function to notify if it changes
 */
const useMigratedQuery = (query: CloudWatchQuery, onChangeQuery: (newQuery: CloudWatchQuery) => void) => {
  const migratedQuery = useMemo(() => migrateQuery(query), [query]);

  useEffect(() => {
    if (migratedQuery !== query) {
      onChangeQuery(migratedQuery);
    }
  }, [migratedQuery, query, onChangeQuery]);

  return migratedQuery;
};

// The frontend doesn't run legacy queries if we don't set the queryMode and region
export function migrateQuery(query: CloudWatchQuery): CloudWatchQuery {
  const newQuery = { ...query };
  if (!newQuery.queryMode) {
    newQuery.queryMode = 'Metrics';
  }
  if (!newQuery.region) {
    newQuery.region = 'default';
  }
  return newQuery;
}

export default useMigratedQuery;
