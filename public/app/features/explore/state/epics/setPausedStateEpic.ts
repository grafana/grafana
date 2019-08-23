import { Epic } from 'redux-observable';
import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { flatMap } from 'rxjs/operators';

import { setPausedStateAction, SetPausedStatePayload } from '../actionTypes';
import { runQueriesAction } from '../actionTypes';
import { EMPTY, of } from 'rxjs';

export const setPausedStateEpic: Epic<ActionOf<any>> = action$ => {
  return action$.ofType(setPausedStateAction.type).pipe(
    flatMap((action: ActionOf<SetPausedStatePayload>) => {
      if (action.payload.isPaused) {
        // Pausing is implemented in runQueriesBatchEpic which listens on this action too in a takeUntil signal. This is
        // not great need to find a way to make this a bit more sensible.
        return EMPTY;
      } else {
        return of(runQueriesAction({ exploreId: action.payload.exploreId }));
      }
    })
  );
};
