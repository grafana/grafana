import deepEqual from 'fast-deep-equal';
import { defaults } from 'lodash';
import { useEffect, useMemo } from 'react';

import { AzureMonitorQuery, AzureQueryType, ResultFormat } from '../../types';
import migrateQuery from '../../utils/migrateQuery';

const DEFAULT_QUERY = {
  queryType: AzureQueryType.AzureMonitor,
};

const transformExemplarQuery = (query: AzureMonitorQuery, defaultSubscriptionId: string) => {
  if (query.queryType === AzureQueryType.TraceExemplar && query.query !== '' && !query.azureTraces) {
    query.azureTraces = {
      operationId: query.query,
      resultFormat: ResultFormat.Trace,
      resources: [`/subscriptions/${defaultSubscriptionId}`],
    };
  }

  return query;
};

const prepareQuery = (query: AzureMonitorQuery, defaultSubscriptionId: string) => {
  // Note: _.defaults does not apply default values deeply.
  const withDefaults = defaults({}, query, DEFAULT_QUERY);
  const transformedQuery = transformExemplarQuery(withDefaults, defaultSubscriptionId);
  const migratedQuery = migrateQuery(transformedQuery);

  // If we didn't make any changes to the object, then return the original object to keep the
  // identity the same, and not trigger any other useEffects or anything.
  return deepEqual(migratedQuery, query) ? query : migratedQuery;
};

/**
 * Returns queries with some defaults + migrations, and calls onChange function to notify if it changes
 */
const usePreparedQuery = (
  query: AzureMonitorQuery,
  onChangeQuery: (newQuery: AzureMonitorQuery) => void,
  defaultSubscriptionId: string
) => {
  const preparedQuery = useMemo(() => prepareQuery(query, defaultSubscriptionId), [query, defaultSubscriptionId]);

  useEffect(() => {
    if (preparedQuery !== query) {
      onChangeQuery(preparedQuery);
    }
  }, [preparedQuery, query, onChangeQuery]);

  return preparedQuery;
};

export default usePreparedQuery;
