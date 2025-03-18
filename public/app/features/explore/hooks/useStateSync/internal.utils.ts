import { isEqual } from 'lodash';

import { CoreApp, DataSourceApi, ExploreUrlState, isTruthy } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { getLastUsedDatasourceUID } from 'app/core/utils/explore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DEFAULT_RANGE } from '../../state/constants';
import { isFulfilled } from '../utils';

export type InitState = 'pending' | 'done' | 'notstarted';

/**
 * Compare 2 explore urls and return a map of what changed. Used to update the local state with all the
 * side effects needed.
 */
export const urlDiff = (
  oldUrlState: ExploreUrlState | undefined,
  currentUrlState: ExploreUrlState | undefined
): {
  datasource: boolean;
  queries: boolean;
  range: boolean;
  panelsState: boolean;
} => {
  const datasource = !isEqual(currentUrlState?.datasource, oldUrlState?.datasource);
  const queries = !isEqual(currentUrlState?.queries, oldUrlState?.queries);
  const range = !isEqual(currentUrlState?.range || DEFAULT_RANGE, oldUrlState?.range || DEFAULT_RANGE);
  const panelsState = !isEqual(currentUrlState?.panelsState, oldUrlState?.panelsState);

  return {
    datasource,
    queries,
    range,
    panelsState,
  };
};

/**
 * Returns the datasource that an explore pane should be using.
 * If the URL specifies a datasource and that datasource exists, it will be used unless said datasource is mixed.
 * Otherwise the datasource will be extracted from the first query specifying a valid datasource.
 *
 * If there's no datasource in the queries, the last used datasource will be used.
 * if there's no last used datasource, the default datasource will be used.
 *
 * @param rootDatasource the top-level datasource specified in the URL
 * @param queries the queries in the pane
 * @param orgId the orgId of the user
 *
 * @returns the datasource UID that the pane should use, undefined if no suitable datasource is found
 */
export async function getPaneDatasource(
  rootDatasource: DataSourceRef | string | null | undefined,
  queries: DataQuery[],
  orgId: number
) {
  // If there's a root datasource, use it unless it's unavailable
  if (rootDatasource) {
    try {
      return await getDatasourceSrv().get(rootDatasource);
    } catch (_) {}
  }

  // Else we try to find a datasource in the queries
  const queriesDatasources = [
    ...new Set(
      queries
        .map((q) => q.datasource)
        .filter(isTruthy)
        .map((ds) => (typeof ds === 'string' ? ds : ds.uid))
    ),
  ];

  try {
    if (queriesDatasources.length >= 1) {
      const datasources = (await Promise.allSettled(queriesDatasources.map((ds) => getDatasourceSrv().get(ds)))).filter(
        isFulfilled
      );

      // if queries have multiple (valid) datasources, we return the mixed datasource
      if (datasources.length > 1) {
        return await getDatasourceSrv().get(MIXED_DATASOURCE_NAME);
      }

      // otherwise we return the first datasource.
      if (datasources.length === 1) {
        return await getDatasourceSrv().get(queriesDatasources[0]);
      }
    }
  } catch (_) {}

  // If none of the queries specify a valid datasource, we use the last used one
  return (
    getDatasourceSrv()
      .get(getLastUsedDatasourceUID(orgId))
      // Or the default one
      .catch(() => getDatasourceSrv().get())
      .catch(() => undefined)
  );
}

export function getDefaultQuery(ds: DataSourceApi) {
  return { ...ds.getDefaultQuery?.(CoreApp.Explore), refId: 'A', datasource: ds.getRef() };
}

export function isMixedDatasource(datasource: DataSourceApi) {
  return datasource.name === MIXED_DATASOURCE_NAME;
}

export function getQueryFilter(datasource?: DataSourceApi) {
  // if the root datasource is mixed, filter out queries that don't have a datasource.
  if (datasource && isMixedDatasource(datasource)) {
    return (q: DataQuery) => !!q.datasource;
  } else {
    // else filter out queries that have a datasource different from the root one.
    // Queries may not have a datasource, if so, it's assumed they are using the root datasource
    return (q: DataQuery) => {
      if (!q.datasource) {
        return true;
      }
      // Due to legacy URLs, `datasource` in queries may be a string. This logic should probably be in the migration
      if (typeof q.datasource === 'string') {
        return q.datasource === datasource?.uid || q.datasource === datasource?.name;
      }

      return q.datasource.uid === datasource?.uid;
    };
  }
}

export async function removeQueriesWithInvalidDatasource(queries: DataQuery[]) {
  const results = await Promise.allSettled(
    queries.map((query) => {
      return getDatasourceSrv()
        .get(query.datasource)
        .then((ds) => ({
          query,
          ds,
        }));
    })
  );

  return results.filter(isFulfilled).map(({ value }) => value.query);
}
