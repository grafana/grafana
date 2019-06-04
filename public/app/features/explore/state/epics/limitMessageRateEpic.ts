import { Epic } from 'redux-observable';
import { map, throttleTime } from 'rxjs/operators';
import { LoadingState } from '@grafana/ui';

import { StoreState } from 'app/types';
import { ActionOf } from '../../../../core/redux/actionCreatorFactory';
import { limitMessageRatePayloadAction, LimitMessageRatePayload, processQueryResultsAction } from '../actionTypes';
import { EpicDependencies } from 'app/store/configureStore';

export const limitMessageRateEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState, EpicDependencies> = action$ => {
  return action$.ofType(limitMessageRatePayloadAction.type).pipe(
    throttleTime(1),
    map((action: ActionOf<LimitMessageRatePayload>) => {
      const { exploreId, series, datasourceId } = action.payload;
      return processQueryResultsAction({
        exploreId,
        latency: 0,
        datasourceId,
        loadingState: LoadingState.Streaming,
        series: null,
        delta: series,
      });
    })
  );
};
