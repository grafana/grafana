import { isEqual } from 'lodash';
import { useEffect, useRef } from 'react';

import { CoreApp, serializeStateToUrlParam } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { getLastUsedDatasourceUID, parseUrlState } from 'app/core/utils/explore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { addListener, ExploreId, ExploreQueryParams, useDispatch, useSelector } from 'app/types';

import { changeDatasource } from '../state/datasource';
import { initializeExplore, urlDiff } from '../state/explorePane';
import { clearPanes, splitClose, splitOpen, syncTimesAction } from '../state/main';
import { runQueries, setQueriesAction } from '../state/query';
import { selectPanes } from '../state/selectors';
import { changeRangeAction, updateTime } from '../state/time';
import { withUniqueRefIds } from '../utils/queries';

import { getUrlStateFromPaneState } from './utils';

/**
 * Bi-directionally syncs URL changes with Explore's state.
 */
export function useStateSync(params: ExploreQueryParams) {
  const {
    location,
    config: {
      featureToggles: { exploreMixedDatasource },
    },
  } = useGrafana();
  const dispatch = useDispatch();
  const statePanes = useSelector(selectPanes);
  const orgId = useSelector((state) => state.user.orgId);
  const prevParams = useRef<ExploreQueryParams>(params);
  const initState = useRef<'notstarted' | 'pending' | 'done'>('notstarted');

  useEffect(() => {
    // This happens when the user navigates to an explore "empty page" while within Explore.
    // ie. by clicking on the explore when explore is active.
    if (!params.left && !params.right) {
      initState.current = 'notstarted';
      prevParams.current = {};
    }
  }, [params]);

  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        predicate: (action) =>
          // We want to update the URL when:
          [
            // - a pane is opened or closed
            splitClose.type,
            splitOpen.fulfilled.type,
            // - a query is run
            runQueries.pending.type,
            // - range is changed
            changeRangeAction.type,
            // - queries are committed
          ].includes(action.type),
        effect: async (_, { cancelActiveListeners, delay, getState }) => {
          // The following 2 lines will throttle the URL updates to 200ms.
          // This is because we don't want to update the URL multiple times when for instance multiple
          // panes trigger a query run at the same time or when queries are executed in very rapid succession.
          cancelActiveListeners();
          await delay(200);

          const { left, right } = getState().explore.panes;
          const orgId = getState().user.orgId.toString();
          const panesState: { [index: string]: string | undefined } = { orgId };

          if (left) {
            panesState.left = serializeStateToUrlParam(getUrlStateFromPaneState(left));
          }

          if (right) {
            panesState.right = serializeStateToUrlParam(getUrlStateFromPaneState(right));
          } else {
            panesState.right = undefined;
          }

          if (prevParams.current.right !== panesState.right || prevParams.current.left !== panesState.left) {
            // If there's no state in the URL it means we are mounting explore for the first time.
            // In that case we want to replace the URL instead of pushing a new entry to the history.
            const replace = !prevParams.current.right && !prevParams.current.left;

            prevParams.current = {
              left: panesState.left,
              right: panesState.right,
            };
            location.partial({ ...panesState }, replace);
          }
        },
      })
    );

    // @ts-expect-error the return type of addListener is actually callable, but dispatch is not middleware-aware
    return () => unsubscribe();
  }, [dispatch, location]);

  useEffect(() => {
    const isURLOutOfSync = prevParams.current?.left !== params.left || prevParams.current?.right !== params.right;

    const urlPanes = {
      left: parseUrlState(params.left),
      ...(params.right && { right: parseUrlState(params.right) }),
    };

    // This happens when the user first navigates to explore.
    // Here we want to initialize each pane initial data, wether it comes
    // from the url or as a result of migrations.
    async function init() {
      initState.current = 'pending';

      // Clear all the panes in the store first to avoid stale data.
      dispatch(clearPanes());

      const initPromises = [];

      for (const [id, { datasource, queries, range, panelsState }] of Object.entries(urlPanes)) {
        // TODO: perform the migration here
        const exploreId = id as ExploreId;

        const paneDatasource = await getPaneDatasource(datasource, queries, orgId, !!exploreMixedDatasource);

        initPromises.push(
          Promise.resolve(
            queries.length
              ? withUniqueRefIds(queries)
              : // if there are no queries, we get a default query from the root datasource.
              // if the datasource is mixed, we get the last used datasource from the store.
              paneDatasource
              ? getDatasourceSrv()
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
              : []
          )
            .then((queries) => {
              // if the root datasource is mixed, filter out queries that don't have a datasource.
              if (paneDatasource === MIXED_DATASOURCE_NAME) {
                return queries.filter((q) => !!q.datasource);
              } else {
                // else filter out queries that have a datasource different from the root one.
                // Queries may not have a datasource, if so, it's assumed they are using the root datasource
                return queries.filter((q) => {
                  if (!q.datasource) {
                    return true;
                  }
                  // Due to legacy URLs, `datasource` in queries may be a string. This logic should probably be in the migration
                  if (typeof q.datasource === 'string') {
                    return q.datasource === paneDatasource;
                  }

                  return q.datasource.uid === paneDatasource;
                });
              }
            })
            .then((queries) => {
              // filters out all the queries that have a non existent datasource
              return Promise.allSettled(
                queries.map((query) => {
                  return getDatasourceSrv()
                    .get(query.datasource)
                    .then((ds) => ({
                      query,
                      ds,
                    }));
                })
              ).then((results) => results.filter(isFulfilled).map(({ value }) => value.query));
            })
            .then((queries) => {
              return dispatch(
                initializeExplore({
                  exploreId,
                  datasource: paneDatasource,
                  queries,
                  range,
                  panelsState,
                })
              ).unwrap();
            })
        );
      }

      Promise.all(initPromises).then((panes) => {
        const urlState = panes.reduce<ExploreQueryParams>((acc, { exploreId, state }) => {
          return { ...acc, [exploreId]: serializeStateToUrlParam(getUrlStateFromPaneState(state)) };
        }, {});

        location.partial({ ...urlState, orgId }, true);

        initState.current = 'done';
      });
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
              queries: withUniqueRefIds(queries),
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
            dispatch(setQueriesAction({ exploreId, queries: withUniqueRefIds(queries) }));
          }

          if (update.queries || update.range) {
            dispatch(runQueries({ exploreId }));
          }
        }
      }

      // Close all the panes that are not in the URL but are still in the store
      // ie. because the user has navigated back after opening the split view.
      Object.keys(statePanes)
        .filter((keyInStore) => !Object.keys(urlPanes).includes(keyInStore))
        .forEach((paneId) => dispatch(splitClose(paneId as ExploreId)));
    }

    if (!isURLOutOfSync && initState.current === 'notstarted') {
      init();
    }

    prevParams.current = {
      left: params.left,
      right: params.right,
    };

    isURLOutOfSync && initState.current === 'done' && sync();
  }, [params.left, params.right, dispatch, statePanes, exploreMixedDatasource, orgId, location]);
}

/**
 * Returns the datasource UID that an explore pane should be using.
 * If the URL specifies a datasource and that datasource exists, it will be used unless said datasource is mixed and `allowMixed` is false.
 * Otherwise the datasource will be extracetd from the the first query specifying a valid datasource.
 *
 * If there's no datasource in the queries, the last used datasource will be used.
 * if there's no last used datasource, the default datasource will be used.
 *
 * @param rootDatasource the top-level datasource specified in the URL
 * @param queries the queries in the pane
 * @param orgId the orgId of the user
 * @param allowMixed whether mixed datasources are allowed
 *
 * @returns the datasource UID that the pane should use
 */
async function getPaneDatasource(
  rootDatasource: DataSourceRef | string | null | undefined,
  queries: DataQuery[],
  orgId: number,
  allowMixed: boolean
) {
  // If there's a root datasource, use it unless it's mixed and we don't allow mixed.
  if (rootDatasource) {
    try {
      const ds = await getDatasourceSrv().get(rootDatasource);

      if ((ds.meta.mixed && allowMixed) || !ds.meta.mixed) {
        return ds.uid;
      }
    } catch (_) {}
  }

  // Else we try to find a datasource in the queries, returning the first one that exists
  const queriesWithDS = queries.filter((q) => q.datasource);
  for (const query of queriesWithDS) {
    try {
      const ds = await getDatasourceSrv().get(query.datasource);

      if ((ds.meta.mixed && allowMixed) || !ds.meta.mixed) {
        return ds.uid;
      }
    } catch (_) {}
  }

  // If none of the queries specify a avalid datasource, we use the last used one
  const lastUsedDSUID = getLastUsedDatasourceUID(orgId);

  return (
    getDatasourceSrv()
      .get(lastUsedDSUID)
      // Or the default one
      .catch(() => getDatasourceSrv().get())
      .then((ds) => ds.uid)
  );
}

const isFulfilled = <T>(input: PromiseSettledResult<T>): input is PromiseFulfilledResult<T> =>
  input.status === 'fulfilled';
