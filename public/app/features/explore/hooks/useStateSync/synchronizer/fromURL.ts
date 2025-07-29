import { isEqual } from 'lodash';

import { EventBusSrv } from '@grafana/data';
import { changeDatasource } from 'app/features/explore/state/datasource';
import {
  changePanelsStateAction,
  initializeExplore,
  updateQueryRefAction,
} from 'app/features/explore/state/explorePane';
import { splitClose, syncTimesAction } from 'app/features/explore/state/main';
import { cancelQueries, runQueries, setQueriesAction } from 'app/features/explore/state/query';
import { updateTime } from 'app/features/explore/state/time';
import { fromURLRange } from 'app/features/explore/state/utils';
import { withUniqueRefIds } from 'app/features/explore/utils/queries';
import { ExploreItemState } from 'app/types/explore';
import { ThunkDispatch } from 'app/types/store';

import { getUrlStateFromPaneState } from '../index';
import { urlDiff } from '../internal.utils';
import { ExploreURLV1 } from '../migrators/v1';

export function syncFromURL(
  urlState: ExploreURLV1,
  panesState: Record<string, undefined | ExploreItemState>,
  dispatch: ThunkDispatch
) {
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
