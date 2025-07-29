import { identity, isEqual } from 'lodash';
import { MutableRefObject } from 'react';

import { EventBusSrv } from '@grafana/data';
import { LocationService } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { initializeExplore } from 'app/features/explore/state/explorePane';
import { clearPanes, syncTimesAction } from 'app/features/explore/state/main';
import { fromURLRange } from 'app/features/explore/state/utils';
import { withUniqueRefIds } from 'app/features/explore/utils/queries';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ThunkDispatch } from 'app/types/store';

import { getUrlStateFromPaneState } from '../index';
import {
  getDefaultQuery,
  getPaneDatasource,
  getQueryFilter,
  InitState,
  isMixedDatasource,
  removeQueriesWithInvalidDatasource,
} from '../internal.utils';
import { ExploreURLV1 } from '../migrators/v1';

export function initializeFromURL(
  urlState: ExploreURLV1,
  initState: MutableRefObject<InitState>,
  orgId: number,
  dispatch: ThunkDispatch,
  location: LocationService
) {
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

          return {
            exploreId,
            range,
            panelsState,
            queries: validQueries,
            datasource: paneDatasource,
          };
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
