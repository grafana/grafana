import { useEffect } from 'react';

import { parseUrlState } from 'app/core/utils/explore';
import { ExploreId, ExploreQueryParams, useDispatch, useSelector } from 'app/types';

import { changeDatasource } from '../state/datasource';
import { initializeExplore, urlDiff } from '../state/explorePane';
import { splitClose } from '../state/main';
import { runQueries, setQueriesAction } from '../state/query';
import { updateTime } from '../state/time';

import { getTimeRangeFromUrl, getUrlStateFromPaneState } from './utils';

/**
 * Syncs URL changes with Explore's panes state by reacting to URL changes and updating the state.
 */
export function useStateSync(params: ExploreQueryParams) {
  const dispatch = useDispatch();
  const panes = useSelector((state) => state.explore.panes);

  const timeZone = useSelector((state) => state.user.timeZone);

  useEffect(() => {
    (async () => {
      const urlPanes = {
        left: parseUrlState(params.left),
        ...(params.right && { right: parseUrlState(params.right) }),
      };

      for (const [id, pane] of Object.entries(urlPanes)) {
        const exploreId = id as ExploreId;
        /**
         * We want to initialize the pane only if:
         * */
        const { datasource, queries, range: initialRange, panelsState } = pane;
        const range = getTimeRangeFromUrl(initialRange, timeZone);

        if (panes[exploreId] === undefined) {
          // TODO: default query
          dispatch(
            initializeExplore({
              exploreId,
              datasource,
              queries,
              range,
              // FIXME: get the actual width
              containerWidth: 1000,
              panelsState,
            })
          );

          continue;
        } else {
          const update = urlDiff(pane, getUrlStateFromPaneState(panes[exploreId]!));

          if (update.datasource) {
            await dispatch(changeDatasource(exploreId, datasource));
          }

          if (update.range) {
            //TODO: We currently do not save whether the time ranges are synced or not in the URL,
            // This means users can't hare explore links with "synced" time ranges.
            // FIXME: if a user syncs the time ranges when 2 panes have different range, going back in history causes
            // the time range to be out of sync, even though the UI shows it as synced.
            // In such cases we should set synced=false when going back in history causes tha time ranges in the URL to be different.
            // A better solution would be to save the synced state in the URL.
            dispatch(updateTime({ exploreId, rawRange: range.raw }));
          }

          if (update.queries) {
            dispatch(setQueriesAction({ exploreId, queries: pane.queries }));
          }

          if (update.queries || update.range) {
            dispatch(runQueries(exploreId));
          }
        }
      }

      // Close all the panes that are not in the URL but are still in the store
      // ie. because the user has navigated back after oprning the split view.
      Object.keys(panes)
        .filter((keyInStore) => !Object.keys(urlPanes).includes(keyInStore))
        .forEach((paneId) => dispatch(splitClose(paneId as ExploreId)));
    })();
    // TODO: check exactly what we should put in the deps array.
  }, [params, dispatch]);
}
