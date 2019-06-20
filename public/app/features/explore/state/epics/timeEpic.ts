import { Epic } from 'redux-observable';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { updateTimeRangeAction, UpdateTimeRangePayload, changeRangeAction } from '../actionTypes';
import { map } from 'rxjs/operators';
import { getTimeRange } from 'app/core/utils/explore';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

export const timeEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (action$, state$) => {
  return action$.ofType(updateTimeRangeAction.type).pipe(
    map((action: ActionOf<UpdateTimeRangePayload>) => {
      const { exploreId } = action.payload;
      const itemState = state$.value.explore[exploreId];
      const timeZone = getTimeZone(state$.value.user);
      const { range: rangeInState } = itemState;
      const range = getTimeRange(timeZone, rangeInState.raw);

      getTimeSrv().setTime(range.raw, false);

      return changeRangeAction({ range, exploreId });
    })
  );
};
