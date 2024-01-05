import { identity, isEmpty, isEqual, isObject, mapValues, omitBy } from 'lodash';
import { useEffect, useRef } from 'react';

import { CoreApp, ExploreUrlState, DataSourceApi, toURLRange, EventBusSrv, isTruthy } from '@grafana/data';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useAppNotification } from 'app/core/copy/appNotification';
import { clearQueryKeys, getLastUsedDatasourceUID } from 'app/core/utils/explore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { addListener, ExploreItemState, ExploreQueryParams, useDispatch, useSelector } from 'app/types';

import { changeDatasource } from '../../state/datasource';
import { changePanelsStateAction, initializeExplore } from '../../state/explorePane';
import { clearPanes, splitClose, splitOpen, syncTimesAction } from '../../state/main';
import { cancelQueries, runQueries, setQueriesAction } from '../../state/query';
import { selectPanes } from '../../state/selectors';
import { changeRangeAction, updateTime } from '../../state/time';
import { DEFAULT_RANGE, fromURLRange } from '../../state/utils';
import { withUniqueRefIds } from '../../utils/queries';
import { isFulfilled } from '../utils';

import { parseURL } from './parseURL';

/**
 * Bi-directionally syncs URL changes with Explore's state.
 */
export function useStateSync(params: ExploreQueryParams) {
  const { location } = useGrafana();
  const dispatch = useDispatch();
  const panesState = useSelector(selectPanes);
  const orgId = useSelector((state) => state.user.orgId);
  const prevParams = useRef(params);
  const initState = useRef<'notstarted' | 'pending' | 'done'>('notstarted');
  const paused = useRef(false);
  const { warning } = useAppNotification();

  useEffect(() => {
    // This happens when the user navigates to an explore "empty page" while within Explore.
    // ie. by clicking on the explore when explore is active.
    if (!params.panes) {
      initState.current = 'notstarted';
      prevParams.current = params;
    }
  }, [params]);

  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        predicate: (action) =>
          /*
          We want to update the URL when:
           - a pane is opened or closed
           - a query is run
           - range is changed
           - panel state is updated
           - a datasource change has completed.

          Note: Changing datasource causes a bunch of actions to be dispatched, we want to update the URL 
          only when the change set has completed. This is done by checking if the changeDatasource.pending action
          has been dispatched and pausing the listener until the changeDatasource.fulfilled action is dispatched.
        */

          {
            paused.current = changeDatasource.pending.type === action.type;

            return (
              [
                splitClose.type,
                splitOpen.fulfilled.type,
                runQueries.pending.type,
                changeRangeAction.type,
                changePanelsStateAction.type,
                changeDatasource.fulfilled.type,
              ].includes(action.type) && !paused.current
            );
          },
        effect: async (_, { cancelActiveListeners, delay, getState }) => {
          // The following 2 lines will debounce updates to avoid creating history entries when rapid changes
          // are committed to the store.
          cancelActiveListeners();
          await delay(200);

          const panesQueryParams = Object.entries(getState().explore.panes).reduce((acc, [id, paneState]) => {
            if (!paneState) {
              return acc;
            }
            return {
              ...acc,
              [id]: getUrlStateFromPaneState(paneState),
            };
          }, {});

          if (!isEqual(prevParams.current.panes, JSON.stringify(panesQueryParams))) {
            // If there's no previous state it means we are mounting explore for the first time,
            // in this case we want to replace the URL instead of pushing a new entry to the history.
            // If the init state is 'pending' it means explore still hasn't finished initializing. in that case we skip
            // pushing a new entry in the history as the first entry will be pushed after initialization.
            const replace =
              (!!prevParams.current.panes && Object.values(prevParams.current.panes).filter(Boolean).length === 0) ||
              initState.current === 'pending';

            prevParams.current = {
              panes: JSON.stringify(panesQueryParams),
            };

            location.partial({ panes: prevParams.current.panes }, replace);
          }
        },
      })
    );

    // @ts-expect-error the return type of addListener is actually callable, but dispatch is not middleware-aware
    return () => unsubscribe();
  }, [dispatch, location]);

  useEffect(() => {
    const isURLOutOfSync = prevParams.current?.panes !== params.panes;

    const [urlState, hasParseError] = parseURL(params);
    hasParseError &&
      warning(
        'Could not parse Explore URL',
        'The requested URL contains invalid parameters, a default Explore state has been loaded.'
      );

    async function sync() {
      // if navigating the history causes one of the time range to not being equal to all the other ones,
      // we set syncedTimes to false to avoid inconsistent UI state.
      // Ideally `syncedTimes` should be saved in the URL.
      const paneArray = Object.values(urlState.panes);
      if (paneArray.length > 1) {
        const paneTimesUnequal = paneArray.some(({ range }, _, [{ range: firstRange }]) => !isEqual(range, firstRange));
        dispatch(syncTimesAction({ syncedTimes: !paneTimesUnequal })); // if all time ranges are equal, keep them synced
      }

      Object.entries(urlState.panes).forEach(async ([exploreId, urlPane], i) => {
        const { datasource, queries, range, panelsState } = urlPane;

        const paneState = panesState[exploreId];

        if (paneState !== undefined) {
          const update = urlDiff(urlPane, getUrlStateFromPaneState(paneState));

          Promise.resolve()
            .then(async () => {
              if (update.datasource && datasource) {
                await dispatch(changeDatasource({ exploreId, datasource }));
              }
              return;
            })
            .then(async () => {
              if (update.range) {
                dispatch(updateTime({ exploreId, rawRange: fromURLRange(range) }));
              }

              if (update.queries) {
                dispatch(setQueriesAction({ exploreId, queries: withUniqueRefIds(queries) }));
              }

              if (update.queries || update.range) {
                await dispatch(cancelQueries(exploreId));
                dispatch(runQueries({ exploreId }));
              }

              if (update.panelsState && panelsState) {
                dispatch(changePanelsStateAction({ exploreId, panelsState }));
              }
            });
        } else {
          // This happens when browser history is used to navigate.
          // In this case we want to initialize the pane with the data from the URL
          // if it's not present in the store. This may happen if the user has navigated
          // from split view to non-split view and then back to split view.
          dispatch(
            initializeExplore({
              exploreId,
              datasource: datasource || '',
              queries: withUniqueRefIds(queries),
              range: fromURLRange(range),
              panelsState,
              position: i,
              eventBridge: new EventBusSrv(),
            })
          );
        }
      });

      // Close all the panes that are not in the URL but are still in the store
      // ie. because the user has navigated back after opening the split view.
      Object.keys(panesState)
        .filter((keyInStore) => !Object.keys(urlState.panes).includes(keyInStore))
        .forEach((paneId) => dispatch(splitClose(paneId)));
    }

    // This happens when the user first navigates to explore.
    // Here we want to initialize each pane initial data, wether it comes
    // from the url or as a result of migrations.
    if (!isURLOutOfSync && initState.current === 'notstarted') {
      initState.current = 'pending';

      // Clear all the panes in the store first to avoid stale data.
      dispatch(clearPanes());

      Promise.all(
        Object.entries(urlState.panes).map(([exploreId, { datasource, queries, range, panelsState }]) => {
          return getPaneDatasource(datasource, queries, orgId).then((paneDatasource) => {
            return Promise.resolve(
              // Given the Grafana datasource will always be present, this should always be defined.
              paneDatasource
                ? queries.length
                  ? // if we have queries in the URL, we use them
                    withUniqueRefIds(queries)
                      // but filter out the ones that are not compatible with the pane datasource
                      .filter(getQueryFilter(paneDatasource))
                      .map(
                        isMixedDatasource(paneDatasource)
                          ? identity<DataQuery>
                          : (query) => ({ ...query, datasource: paneDatasource.getRef() })
                      )
                  : getDatasourceSrv()
                      // otherwise we get a default query from the pane datasource or from the default datasource if the pane datasource is mixed
                      .get(isMixedDatasource(paneDatasource) ? undefined : paneDatasource.getRef())
                      .then((ds) => [getDefaultQuery(ds)])
                : []
            ).then(async (queries) => {
              // we remove queries that have an invalid datasources
              let validQueries = await removeQueriesWithInvalidDatasource(queries);

              if (!validQueries.length && paneDatasource) {
                // and in case there's no query left we add a default one.
                validQueries = [
                  getDefaultQuery(isMixedDatasource(paneDatasource) ? await getDatasourceSrv().get() : paneDatasource),
                ];
              }

              return { exploreId, range, panelsState, queries: validQueries, datasource: paneDatasource };
            });
          });
        })
      ).then(async (panes) => {
        const initializedPanes = await Promise.all(
          panes.map(({ exploreId, range, panelsState, queries, datasource }) => {
            return dispatch(
              initializeExplore({
                exploreId,
                datasource,
                queries,
                range: fromURLRange(range),
                panelsState,
                eventBridge: new EventBusSrv(),
              })
            ).unwrap();
          })
        );

        if (initializedPanes.length > 1) {
          const paneTimesUnequal = initializedPanes.some(
            ({ state }, _, [{ state: firstState }]) => !isEqual(state.range.raw, firstState.range.raw)
          );
          dispatch(syncTimesAction({ syncedTimes: !paneTimesUnequal })); // if all time ranges are equal, keep them synced
        }

        const panesObj = initializedPanes.reduce((acc, { exploreId, state }) => {
          return {
            ...acc,
            [exploreId]: getUrlStateFromPaneState(state),
          };
        }, {});

        // we need to use partial here beacuse replace doesn't encode the query params.
        const oldQuery = location.getSearchObject();

        // we create the default query params from the current URL, omitting all the properties we know should be in the final url.
        // This includes params from previous schema versions and 'schemaVersion', 'panes', 'orgId' as we want to replace those.
        let defaults: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(oldQuery).filter(
          ([key]) => !['schemaVersion', 'panes', 'orgId', 'left', 'right'].includes(key)
        )) {
          defaults[key] = value;
        }

        const searchParams = new URLSearchParams({
          // we set the schemaVersion as the first parameter so that when URLs are truncated the schemaVersion is more likely to be present.
          schemaVersion: `${urlState.schemaVersion}`,
          panes: JSON.stringify(panesObj),
          orgId: `${orgId}`,
          ...defaults,
        });

        location.replace({
          pathname: location.getLocation().pathname,
          search: searchParams.toString(),
        });
        initState.current = 'done';
      });
    }

    prevParams.current = params;

    if (isURLOutOfSync && initState.current === 'done') {
      sync();
    }
  }, [dispatch, panesState, orgId, location, params, warning]);
}

function getDefaultQuery(ds: DataSourceApi) {
  return { ...ds.getDefaultQuery?.(CoreApp.Explore), refId: 'A', datasource: ds.getRef() };
}

function isMixedDatasource(datasource: DataSourceApi) {
  return datasource.name === MIXED_DATASOURCE_NAME;
}

function getQueryFilter(datasource?: DataSourceApi) {
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
        return q.datasource === datasource?.uid;
      }

      return q.datasource.uid === datasource?.uid;
    };
  }
}

async function removeQueriesWithInvalidDatasource(queries: DataQuery[]) {
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

/**
 * Returns the datasource that an explore pane should be using.
 * If the URL specifies a datasource and that datasource exists, it will be used unless said datasource is mixed.
 * Otherwise the datasource will be extracetd from the the first query specifying a valid datasource.
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
async function getPaneDatasource(
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

/**
 * Compare 2 explore urls and return a map of what changed. Used to update the local state with all the
 * side effects needed.
 */
const urlDiff = (
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

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
    // lets just fallback instead of crashing.
    datasource: pane.datasourceInstance?.uid || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toURLRange(pane.range.raw),
    // don't include panelsState in the url unless a piece of state is actually set
    panelsState: pruneObject(pane.panelsState),
  };
}

/**
 * recursively walks an object, removing keys where the value is undefined
 * if the resulting object is empty, returns undefined
 **/
function pruneObject(obj: object): object | undefined {
  let pruned = mapValues(obj, (value) => (isObject(value) ? pruneObject(value) : value));
  pruned = omitBy<typeof pruned>(pruned, isEmpty);
  if (isEmpty(pruned)) {
    return undefined;
  }
  return pruned;
}
