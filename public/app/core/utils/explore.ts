import { customAlphabet } from 'nanoid';
import { Unsubscribable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  AdHocVariableFilter,
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceRef,
  DefaultTimeZone,
  getNextRefId,
  IntervalValues,
  locationUtil,
  LogsDedupStrategy,
  LogsSortOrder,
  rangeUtil,
  RawTimeRange,
  ScopedVars,
  TimeRange,
  TimeZone,
  toURLRange,
  urlUtil,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';
import store from 'app/core/store';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { QueryOptions, QueryTransaction } from 'app/types/explore';

export const DEFAULT_UI_STATE = {
  dedupStrategy: LogsDedupStrategy.none,
};

export const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(ID_ALPHABET, 3);

const LAST_USED_DATASOURCE_KEY = 'grafana.explore.datasource';
const lastUsedDatasourceKeyForOrgId = (orgId: number) => `${LAST_USED_DATASOURCE_KEY}.${orgId}`;
export const getLastUsedDatasourceUID = (orgId: number) =>
  store.getObject<string>(lastUsedDatasourceKeyForOrgId(orgId));
export const setLastUsedDatasourceUID = (orgId: number, datasourceUID: string) =>
  store.setObject(lastUsedDatasourceKeyForOrgId(orgId), datasourceUID);

export interface GetExploreUrlArguments {
  queries: DataQuery[];
  dsRef: DataSourceRef | null | undefined;
  timeRange: TimeRange;
  scopedVars: ScopedVars | undefined;
  adhocFilters?: AdHocVariableFilter[];
}

export function generateExploreId() {
  while (true) {
    const id = nanoid(3);

    if (!/^\d+$/.test(id)) {
      return id;
    }
  }
}

/**
 * Returns an Explore-URL that contains a panel's queries and the dashboard time range.
 */
export async function getExploreUrl(args: GetExploreUrlArguments): Promise<string | undefined> {
  const { queries, dsRef, timeRange, scopedVars, adhocFilters } = args;
  const interpolatedQueries = (
    await Promise.allSettled(
      queries
        // Explore does not support expressions so filter those out
        .filter((q) => q.datasource?.uid !== ExpressionDatasourceUID)
        .map(async (q) => {
          // if the query defines a datasource, use that one, otherwise use the one from the panel, which should always be defined.
          // this will rejects if the datasource is not found, or return the default one if dsRef is not provided.
          const queryDs = await getDataSourceSrv().get(q.datasource || dsRef);

          return {
            // interpolate the query using its datasource `interpolateVariablesInQueries` method if defined, othewise return the query as-is.
            ...(queryDs.interpolateVariablesInQueries?.([q], scopedVars ?? {}, adhocFilters)[0] || q),
            // But always set the datasource as it's  required in Explore.
            // NOTE: if for some reason the query has the "mixed" datasource, we omit the property;
            // Upon initialization, Explore use its own logic to determine the datasource.
            ...(!queryDs.meta.mixed && { datasource: queryDs.getRef() }),
          };
        })
    )
  )
    .filter(
      <T>(promise: PromiseSettledResult<T>): promise is PromiseFulfilledResult<T> => promise.status === 'fulfilled'
    )
    .map((q) => q.value);

  const exploreState = JSON.stringify({
    [generateExploreId()]: {
      range: toURLRange(timeRange.raw),
      queries: interpolatedQueries,
      datasource: dsRef?.uid,
    },
  });
  return locationUtil.assureBaseUrl(urlUtil.renderUrl('/explore', { panes: exploreState, schemaVersion: 1 }));
}

export function requestIdGenerator(exploreId: string) {
  return `explore_${exploreId}`;
}

export function buildQueryTransaction(
  exploreId: string,
  queries: DataQuery[],
  queryOptions: QueryOptions,
  range: TimeRange,
  scanning: boolean,
  timeZone?: TimeZone,
  scopedVars?: ScopedVars
): QueryTransaction {
  const panelId = Number.parseInt(exploreId, 36);
  const { interval, intervalMs } = getIntervals(range, queryOptions.minInterval, queryOptions.maxDataPoints);

  const request: DataQueryRequest = {
    app: CoreApp.Explore,
    // TODO probably should be taken from preferences but does not seem to be used anyway.
    timezone: timeZone || DefaultTimeZone,
    startTime: Date.now(),
    interval,
    intervalMs,
    panelId,
    targets: queries, // Datasources rely on DataQueries being passed under the targets key.
    range,
    requestId: requestIdGenerator(exploreId),
    rangeRaw: range.raw,
    scopedVars: {
      __interval: { text: interval, value: interval },
      __interval_ms: { text: intervalMs, value: intervalMs },
      ...scopedVars,
    },
    maxDataPoints: queryOptions.maxDataPoints,
    liveStreaming: queryOptions.liveStreaming,
    skipQueryCache: true,
  };

  return {
    queries,
    request,
    scanning,
    id: generateKey(), // reusing for unique ID
    done: false,
  };
}

export const clearQueryKeys: (query: DataQuery) => DataQuery = ({ key, ...rest }) => rest;

export const safeStringifyValue = (value: unknown, space?: number) => {
  if (value === undefined || value === null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};

export function generateKey(index = 0): string {
  return `Q-${uuidv4()}-${index}`;
}

export async function generateEmptyQuery(
  queries: DataQuery[],
  index = 0,
  dataSourceOverride?: DataSourceRef
): Promise<DataQuery> {
  let datasourceInstance: DataSourceApi | undefined;
  let datasourceRef: DataSourceRef | null | undefined;
  let defaultQuery: Partial<DataQuery> | undefined;

  // datasource override is if we have switched datasources with no carry-over - we want to create a new query with a datasource we define
  // it's also used if there's a root datasource and there were no previous queries
  if (dataSourceOverride) {
    datasourceRef = dataSourceOverride;
  } else if (queries.length > 0 && queries[queries.length - 1].datasource) {
    // otherwise use last queries' datasource
    datasourceRef = queries[queries.length - 1].datasource;
  } else {
    datasourceInstance = await getDataSourceSrv().get();
    defaultQuery = datasourceInstance.getDefaultQuery?.(CoreApp.Explore);
    datasourceRef = datasourceInstance.getRef();
  }

  if (!datasourceInstance) {
    datasourceInstance = await getDataSourceSrv().get(datasourceRef);
    defaultQuery = datasourceInstance.getDefaultQuery?.(CoreApp.Explore);
  }

  return { ...defaultQuery, refId: getNextRefId(queries), key: generateKey(index), datasource: datasourceRef };
}

export const generateNewKeyAndAddRefIdIfMissing = (target: DataQuery, queries: DataQuery[], index = 0): DataQuery => {
  const key = generateKey(index);
  const refId = target.refId || getNextRefId(queries);

  return { ...target, refId, key };
};

/**
 * Ensure at least one target exists and that targets have the necessary keys
 *
 * This will return an empty array if there are no datasources, as Explore is not usable in that state
 */
export async function ensureQueries(
  queries?: DataQuery[],
  newQueryDataSourceOverride?: DataSourceRef
): Promise<DataQuery[]> {
  if (queries && typeof queries === 'object' && queries.length > 0) {
    const allQueries = [];
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      const key = generateKey(index);
      let refId = query.refId;
      if (!refId) {
        refId = getNextRefId(allQueries);
      }

      // if a query has a datasource, validate it and only add it if valid
      // if a query doesn't have a datasource, do not worry about it at this step
      let validDS = true;
      if (query.datasource) {
        try {
          await getDataSourceSrv().get(query.datasource.uid);
        } catch {
          console.error(`One of the queries has a datasource that is no longer available and was removed.`);
          validDS = false;
        }
      }

      if (validDS) {
        allQueries.push({
          ...query,
          refId,
          key,
        });
      }
    }
    return allQueries;
  }
  try {
    // if a datasource override get its ref, otherwise get the default datasource
    const emptyQueryRef = newQueryDataSourceOverride ?? (await getDataSourceSrv().get()).getRef();
    const emptyQuery = await generateEmptyQuery(queries ?? [], undefined, emptyQueryRef);
    return [emptyQuery];
  } catch {
    // if there are no datasources, return an empty array because we will not allow use of explore
    // this will occur on init of explore with no datasources defined
    return [];
  }
}

/**
 * A target is non-empty when it has keys (with non-empty values) other than refId, key, context and datasource.
 * FIXME: While this is reasonable for practical use cases, a query without any propery might still be "non-empty"
 * in its own scope, for instance when there's no user input needed. This might be the case for an hypothetic datasource in
 * which query options are only set in its config and the query object itself, as generated from its query editor it's always "empty"
 */
const validKeys = ['refId', 'key', 'context', 'datasource'];
export function hasNonEmptyQuery<TQuery extends DataQuery>(queries: TQuery[]): boolean {
  return (
    queries &&
    queries.some((query) => {
      const entries = Object.entries(query)
        .filter(([key, _]) => validKeys.indexOf(key) === -1)
        .filter(([_, value]) => value);
      return entries.length > 0;
    })
  );
}

export const getQueryKeys = (queries: DataQuery[]): string[] => {
  const queryKeys = queries.reduce<string[]>((newQueryKeys, query, index) => {
    const primaryKey = query.datasource?.uid || query.key;
    return newQueryKeys.concat(`${primaryKey}-${index}`);
  }, []);

  return queryKeys;
};

export const getTimeRange = (timeZone: TimeZone, rawRange: RawTimeRange, fiscalYearStartMonth: number): TimeRange => {
  let range = rangeUtil.convertRawToRange(rawRange, timeZone, fiscalYearStartMonth);

  return range;
};

export const refreshIntervalToSortOrder = (refreshInterval?: string) =>
  RefreshPicker.isLive(refreshInterval) ? LogsSortOrder.Ascending : LogsSortOrder.Descending;

export const stopQueryState = (querySubscription: Unsubscribable | undefined) => {
  if (querySubscription) {
    querySubscription.unsubscribe();
  }
};

export function getIntervals(range: TimeRange, lowLimit?: string, resolution?: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return rangeUtil.calculateInterval(range, resolution, lowLimit);
}

export const copyStringToClipboard = (string: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(string);
  } else {
    const el = document.createElement('textarea');
    el.value = string;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
};
