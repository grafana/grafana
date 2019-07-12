import { Epic } from 'redux-observable';
import { NEVER } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { hasNonEmptyQuery } from 'app/core/utils/explore';
import {
  clearQueriesAction,
  runQueriesAction,
  RunQueriesPayload,
  runQueriesBatchAction,
  stateSaveAction,
} from '../actionTypes';

export const runQueriesEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(runQueriesAction.type).pipe(
    mergeMap((action: ActionOf<RunQueriesPayload>) => {
      const { exploreId } = action.payload;
      const { datasourceInstance, queries, datasourceError, containerWidth, isLive } = state$.value.explore[exploreId];

      if (datasourceError) {
        // let's not run any queries if data source is in a faulty state
        return NEVER;
      }

      if (!hasNonEmptyQuery(queries)) {
        return [clearQueriesAction({ exploreId }), stateSaveAction()]; // Remember to save to state and update location
      }

      // Some datasource's query builders allow per-query interval limits,
      // but we're using the datasource interval limit for now
      const interval = datasourceInstance.interval;
      const live = isLive;

      return [runQueriesBatchAction({ exploreId, queryOptions: { interval, maxDataPoints: containerWidth, live } })];
    })
  );
};
