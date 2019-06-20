import { Epic } from 'redux-observable';
import { map } from 'rxjs/operators';
import { AbsoluteTimeRange, RawTimeRange } from '@grafana/ui';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { updateTimeRangeAction, UpdateTimeRangePayload, changeRangeAction } from '../actionTypes';

export const timeEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState> = (
  action$,
  state$,
  { getTimeSrv, getTimeRange, getTimeZone, toUtc, dateTime }
) => {
  return action$.ofType(updateTimeRangeAction.type).pipe(
    map((action: ActionOf<UpdateTimeRangePayload>) => {
      const { exploreId, absoluteRange: absRange, rawRange: actionRange } = action.payload;
      const itemState = state$.value.explore[exploreId];
      const timeZone = getTimeZone(state$.value.user);
      const { range: rangeInState } = itemState;
      let rawRange: RawTimeRange = rangeInState.raw;

      if (absRange) {
        rawRange = {
          from: timeZone.isUtc ? toUtc(absRange.from) : dateTime(absRange.from),
          to: timeZone.isUtc ? toUtc(absRange.to) : dateTime(absRange.to),
        };
      }

      if (actionRange) {
        rawRange = actionRange;
      }

      const range = getTimeRange(timeZone, rawRange);
      const absoluteRange: AbsoluteTimeRange = { from: range.from.valueOf(), to: range.to.valueOf() };

      getTimeSrv().init({
        time: range.raw,
        refresh: false,
        getTimezone: () => timeZone.raw,
        timeRangeUpdated: () => undefined,
      });

      return changeRangeAction({ exploreId, range, absoluteRange });
    })
  );
};
