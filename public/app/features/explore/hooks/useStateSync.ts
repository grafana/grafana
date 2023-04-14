import { isEqual } from 'lodash';
import { useEffect, useRef } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useGrafana } from 'app/core/context/GrafanaContext';
import store from 'app/core/store';
import { lastUsedDatasourceKeyForOrgId, parseUrlState } from 'app/core/utils/explore';
import { getNextRefIdChar } from 'app/core/utils/query';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { ExploreId, ExploreQueryParams, useDispatch, useSelector } from 'app/types';

import { changeDatasource } from '../state/datasource';
import { initializeExplore, urlDiff } from '../state/explorePane';
import { clearPanes, splitClose, syncTimesAction } from '../state/main';
import { runQueries, setQueriesAction } from '../state/query';
import { updateTime } from '../state/time';

import { getUrlStateFromPaneState } from './utils';

/**
 * Syncs URL changes with Explore's panes state by reacting to URL changes and updating the state.
 */
export function useStateSync(params: ExploreQueryParams) {
  const {
    config: {
      featureToggles: { exploreMixedDatasource },
    },
  } = useGrafana();
  const dispatch = useDispatch();
  const statePanes = useSelector((state) => state.explore.panes);
  const orgId = useSelector((state) => state.user.orgId);
  const prevParams = useRef<ExploreQueryParams>(params);
  const initState = useRef<'notstarted' | 'pending' | 'done'>('notstarted');

  useEffect(() => {
    const shouldSync = prevParams.current?.left !== params.left || prevParams.current?.right !== params.right;

    const urlPanes = {
      left: parseUrlState(params.left),
      ...(params.right && { right: parseUrlState(params.right) }),
    };

    if (!shouldSync && initState.current === 'notstarted') {
      initState.current = 'pending';
      // This happens when the user first navigates to explore.
      // Here we want to initialize each pane initial data, wether it comes
      // from the url or as a result of migrations.

      // Clear all the panes in the store first to avoid stale data.
      dispatch(clearPanes());

      const initPromises = [];

      for (const [id, { datasource, queries, range, panelsState }] of Object.entries(urlPanes)) {
        // TODO: perform the migration here
        const exploreId = id as ExploreId;

        const paneDatasource =
          exploreMixedDatasource && datasource === MIXED_DATASOURCE_NAME
            ? MIXED_DATASOURCE_NAME
            : queries[0]?.datasource || store.get(lastUsedDatasourceKeyForOrgId(orgId));

        // if there are no queries, we get a default query from the datasource.
        // if the datasource is mixed, we get the last used datasource from the store.
        initPromises.push(
          Promise.resolve(
            queries.length
              ? withUniqueRefIds(queries)
              : getDatasourceSrv()
                  // TODO: instead of undefined, we should use the last used top-level datasource,
                  // if that happens to be mixed, its query should be the last selected datasource from the query rows:
                  // 1. keep saving the last used top level ds
                  // 2. start saving rows datasources when they change.
                  // 3. if top-level is mixed, use the last used row datasource
                  // 4. if not, use the top-level one.
                  .get(paneDatasource === MIXED_DATASOURCE_NAME ? undefined : paneDatasource)
                  // if for some reason the aboive fails (ie. datasource removed or whatnot), we fallback to the default one.
                  .catch(() => getDatasourceSrv().get())
                  .then((ds) => [{ refId: 'A', datasource: ds.getRef(), ...ds.getDefaultQuery?.(CoreApp.Explore) }])
          ).then((queries) => {
            dispatch(
              initializeExplore({
                exploreId,
                datasource: paneDatasource,
                queries,
                range,
                panelsState,
              })
            );
          })
        );
      }

      Promise.all(initPromises).then(() => (initState.current = 'done'));
    }

    async function sync() {
      // if navigating the history causes one of the time range
      // to not being equal to all the other ones, we set syncedTimes to false
      // to avoid inconsistent UI state.
      // TODO: ideally `syncedTimes` should be saved in the URL.
      if (
        Object.values(urlPanes).some((pane, i, panes) => {
          if (i === 0) {
            return false;
          }
          return !isEqual(pane.range, panes[i - 1].range);
        })
      ) {
        dispatch(syncTimesAction({ syncedTimes: false }));
      }

      for (const [id, urlPane] of Object.entries(urlPanes)) {
        const exploreId = id as ExploreId;
        const { datasource, queries, range, panelsState } = urlPane;

        if (statePanes[exploreId] === undefined) {
          // This happens when browser history is used to navigate.
          // In this case we want to initialize the pane with the data from the URL
          // if it's not present in the store. This may happen if the user has navigated
          // from split view to non-split view and then back to split view.
          dispatch(
            initializeExplore({
              exploreId,
              datasource,
              queries,
              range,
              panelsState,
            })
          );
        } else {
          // TODO: urlDiff should also handle panelsState changes
          const update = urlDiff(urlPane, getUrlStateFromPaneState(statePanes[exploreId]!));

          if (update.datasource) {
            // FIXME: yikes! a wild await inside a loop!
            await dispatch(changeDatasource(exploreId, datasource));
          }

          if (update.range) {
            dispatch(updateTime({ exploreId, rawRange: range }));
          }

          if (update.queries) {
            dispatch(setQueriesAction({ exploreId, queries }));
          }

          if (update.queries || update.range) {
            dispatch(runQueries(exploreId));
          }
        }
      }

      // Close all the panes that are not in the URL but are still in the store
      // ie. because the user has navigated back after opening the split view.
      Object.keys(statePanes)
        .filter((keyInStore) => !Object.keys(urlPanes).includes(keyInStore))
        .forEach((paneId) => dispatch(splitClose(paneId as ExploreId)));
    }

    prevParams.current = {
      left: params.left,
      right: params.right,
    };

    shouldSync && initState.current === 'done' && sync();
  }, [params.left, params.right, dispatch, statePanes, exploreMixedDatasource, orgId]);
}

/**
 * Makes sure all the queries have unique (and valid) refIds
 */
function withUniqueRefIds(queries: DataQuery[]): DataQuery[] {
  const refIds = new Set<string>(queries.map((query) => query.refId).filter(Boolean));

  if (refIds.size === queries.length) {
    return queries;
  }

  refIds.clear();

  return queries.map((query) => {
    if (query.refId && !refIds.has(query.refId)) {
      refIds.add(query.refId);
      return query;
    }

    const refId = getNextRefIdChar(queries);
    refIds.add(refId);

    const newQuery = {
      ...query,
      refId,
    };

    return newQuery;
  });
}
