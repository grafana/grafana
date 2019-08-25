import { Epic } from 'redux-observable';
import { flatMap, groupBy, values } from 'lodash';
import { bufferTime, mergeMap } from 'rxjs/operators';
import { from } from 'rxjs';
import { DataFrame, LoadingState } from '@grafana/data';

import { StoreState } from 'app/types';
import { ActionOf } from '../../../../core/redux';
import {
  LimitMessageRatePayload,
  limitMessageRatePayloadAction,
  processQueryResultsAction,
  ProcessQueryResultsPayload,
} from '../actionTypes';
import { EpicDependencies } from 'app/store/configureStore';
import { NUMBER_OF_ROWS_SHOWN } from '../../utils/ResultProcessor';

/**
 * Epic that tries to deal with performance problems of showing stream with too much through put. In live tail right now
 * we show only fixed max number of rows, so if there is high through put there is not point in passing on too much data
 * anyway and also too high refresh rate on rendering would slow down all the interactions.
 *
 * Right now this tries to buffer the messages in some time frame while capping the buffer and throwing away excess
 * messages that we would not render anyway.
 *
 * Ideally this would be somehow adaptive, we probably can append single lines in bit higher refresh rate than if
 * we have to render 1000 lines every few milliseconds for example. But 500mills is probably enough refresh rate for
 * this.
 */
export const limitMessageRateEpic: Epic<ActionOf<any>, ActionOf<any>, StoreState, EpicDependencies> = (
  action$,
  state$
) => {
  const buffered$ = action$.ofType(limitMessageRatePayloadAction.type).pipe(bufferTime(500));
  return buffered$.pipe(
    mergeMap((actions: Array<ActionOf<LimitMessageRatePayload>>) => {
      // There can be two different live tailing windows so need to split and group the messages accordingly
      const grouped = groupBy(actions, (action: ActionOf<LimitMessageRatePayload>) => action.payload.exploreId);
      const resultActions = values(grouped).map(mapToProcessQueryResultsActionWithCap(NUMBER_OF_ROWS_SHOWN));
      return from(resultActions);
    })
  );
};

/**
 * Map actions to processQueryResultsAction, while trying to imperfectly cap the number of rows, passed on to the final
 * processing.
 */
const mapToProcessQueryResultsActionWithCap = (cap: number) => (
  actions: Array<ActionOf<LimitMessageRatePayload>>
): ActionOf<ProcessQueryResultsPayload> => {
  const { datasourceId, exploreId } = actions[0].payload;
  // This is just approximate, the dataframes are merged and sliced later on when processing the result in different
  // epic. The number should be the same as rows shown on the screen otherwise we will get gaps.
  const delta = capDataFrameRows(cap, flatMap(actions.map(actions => actions.payload.series)));

  return processQueryResultsAction({
    exploreId,
    latency: 0,
    datasourceId,
    loadingState: LoadingState.Streaming,
    series: null,
    delta,
  });
};

/**
 * Given array of DataFrames return smaller list of data frames which summed row count is just over the or equal the
 * rows param. This does not give exact row count, for that we would need to merge and slice the DataFrames.
 * @param rows
 * @param dataFrames
 */
const capDataFrameRows = (rows: number, dataFrames: DataFrame[]): DataFrame[] => {
  dataFrames.reverse();
  let accumulatorCount = 0;
  const accumulator = [];
  for (const df of dataFrames) {
    if (accumulatorCount < rows) {
      accumulator.unshift(df);
      accumulatorCount += df.length;
    }
  }
  return accumulator;
};
