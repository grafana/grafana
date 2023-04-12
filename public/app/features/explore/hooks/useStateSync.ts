import { isEqual } from 'lodash';
import { useEffect, useRef } from 'react';

import { parseUrlState } from 'app/core/utils/explore';
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
  const dispatch = useDispatch();
  const statePanes = useSelector((state) => state.explore.panes);
  const prevParams = useRef<ExploreQueryParams>(params);
  const initialized = useRef(false);

  useEffect(() => {
    const shouldSync = prevParams.current?.left !== params.left || prevParams.current?.right !== params.right;

    const urlPanes = {
      left: parseUrlState(params.left),
      ...(params.right && { right: parseUrlState(params.right) }),
    };

    if (!shouldSync && !initialized.current) {
      // This happens when the user first navigates to explore.
      // Here we want to initialize each pane initial data, wether it comes
      // from the url or as a result of migrations.

      // Clear all the panes in the store first to avoid stale data.
      dispatch(clearPanes());

      for (const [id, urlPane] of Object.entries(urlPanes)) {
        // TODO: perform the migration here
        const exploreId = id as ExploreId;
        const { datasource, queries, range, panelsState } = urlPane;

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
      }

      initialized.current = true;
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
              // FIXME: get the actual width
              containerWidth: 1000,
              panelsState,
            })
          );
        } else {
          // TODO: urlDiff should also handle panelsState changes
          const update = urlDiff(urlPane, getUrlStateFromPaneState(statePanes[exploreId]!));

          if (update.datasource) {
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

    shouldSync && sync();
  }, [params.left, params.right, dispatch, statePanes]);
}
