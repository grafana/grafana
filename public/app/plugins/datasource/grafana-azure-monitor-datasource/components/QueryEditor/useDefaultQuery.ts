import { useEffect, useMemo } from 'react';
import { AzureMonitorQuery, AzureQueryType } from '../../types';

const DEFAULT_QUERY_TYPE = AzureQueryType.AzureMonitor;

const createQueryWithDefaults = (query: AzureMonitorQuery) => {
  // A quick and easy way to set just the default query type. If we want to set any other defaults,
  // we might want to look into something more robust
  if (!query.queryType) {
    return {
      ...query,
      queryType: query.queryType ?? DEFAULT_QUERY_TYPE,
    };
  }

  return query;
};

/**
 * Returns queries with some defaults, and calls onChange function to notify if it changes
 */
const useDefaultQuery = (query: AzureMonitorQuery, onChangeQuery: (newQuery: AzureMonitorQuery) => void) => {
  const queryWithDefaults = useMemo(() => createQueryWithDefaults(query), [query]);

  useEffect(() => {
    if (queryWithDefaults !== query) {
      onChangeQuery(queryWithDefaults);
    }
  }, [queryWithDefaults, query, onChangeQuery]);

  return queryWithDefaults;
};

export default useDefaultQuery;
