import { isEqual } from 'lodash';

import { EventBusSrv } from '@grafana/data';
import { type LocationService } from '@grafana/runtime';
import { changeDatasource } from 'app/features/explore/state/datasource';
import {
  changePanelsStateAction,
  initializeExplore,
  setAddingSavedQueryAction,
  updateEditSavedQueryRefAction,
} from 'app/features/explore/state/explorePane';
import { splitClose, syncTimesAction } from 'app/features/explore/state/main';
import { cancelQueries, runQueries, setQueriesAction } from 'app/features/explore/state/query';
import { updateTime } from 'app/features/explore/state/time';
import { fromURLRange } from 'app/features/explore/state/utils';
import { withUniqueRefIds } from 'app/features/explore/utils/queries';
import { type ExploreItemState } from 'app/types/explore';
import { type ThunkDispatch } from 'app/types/store';

import { getUrlStateFromPaneState } from '../external.utils';
import { urlDiff } from '../internal.utils';
import { type ExploreURLV1 } from '../migrators/v1';

export function syncFromURL(
  urlState: ExploreURLV1,
  panesState: Record<string, undefined | ExploreItemState>,
  dispatch: ThunkDispatch,
  location: LocationService
) {
  // Saved query being edited via "Edit in Explore" (?editSavedQueryRef=<uid>). Read here too — not just at
  // init — so the "Editing from saved queries" banner also shows when navigating from within Explore
  // (e.g. the Saved Queries modal), which goes through this sync path rather than a cold init.
  const editSavedQueryRef = location.getSearch().get('editSavedQueryRef') ?? undefined;
  // Same for "Add to saved queries" (?createSavedQuery=true): in-Explore navigations mint a new pane id
  // and go through sync rather than cold init, so we must seed add mode here too.
  const addingSavedQuery = location.getSearch().get('createSavedQuery') === 'true';
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
      // First pane only, mirroring the init path. Only set when present so ordinary history navigation
      // doesn't clobber an in-place editing session.
      if (i === 0 && editSavedQueryRef && paneState.editSavedQueryRef !== editSavedQueryRef) {
        dispatch(updateEditSavedQueryRefAction({ exploreId, editSavedQueryRef }));
      }
      if (i === 0 && addingSavedQuery && !paneState.addingSavedQuery) {
        dispatch(setAddingSavedQueryAction({ exploreId, addingSavedQuery: true }));
      }

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
          compact: !!urlPane.compact,
          position: i,
          eventBridge: new EventBusSrv(),
          editSavedQueryRef: i === 0 ? editSavedQueryRef : undefined,
          addingSavedQuery: i === 0 ? addingSavedQuery : undefined,
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
